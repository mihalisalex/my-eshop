import "server-only";
import { prisma } from "@/lib/prisma";
import { toOrder } from "@/lib/commerce/postgres/mappers";
import { getEmailProvider, shippingUpdateEmail } from "@/lib/email";
import { getSiteSettings } from "@/services/settings";
import type { Order } from "@/lib/commerce/types";

export async function getOrderById(id: string): Promise<Order | null> {
  const row = await prisma.order.findUnique({ where: { id } });
  return row ? toOrder(row) : null;
}

export async function getOrdersForCustomer(customerId: string): Promise<Order[]> {
  const rows = await prisma.order.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } });
  return rows.map(toOrder);
}

export async function getAllOrdersForAdmin(): Promise<Order[]> {
  const rows = await prisma.order.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toOrder);
}

/** The statuses that mean the goods are not going out, so their units belong back on the shelf. */
const STOCK_RETURNING_STATUSES = new Set(["cancelled", "refunded"]);

/**
 * Puts an order's units back into `ProductSize.quantity`.
 *
 * `completeCheckout` decrements stock inside the order transaction and, until now,
 * nothing ever incremented it back: cancelling or refunding an order changed its status
 * and nothing else. In a catalog where every size holds one unit, a single cancellation
 * removed that variant from sale permanently until someone edited the product by hand.
 *
 * Claimed with a null-guarded `updateMany` BEFORE any stock is written, so two concurrent
 * status changes (or a re-save of an already-cancelled order) cannot both credit the same
 * units — exactly the pattern `sendOrderConfirmationEmail` uses for its own once-only
 * guarantee. If the restock itself then fails, the claim is released so a later attempt
 * can retry rather than the order being permanently marked as settled.
 *
 * Only lines whose product denies overselling are restored. For an `inventoryPolicy:
 * "continue"` product the original decrement was `min(ordered, available)` rather than the
 * ordered quantity, so crediting the full amount back could invent stock that never
 * existed; that case is skipped deliberately rather than guessed at. Every product in this
 * catalog is currently "deny", so the distinction is precautionary.
 */
async function restockOrderIfNeeded(orderId: string, lineItems: Order["lineItems"]): Promise<void> {
  if (lineItems.length === 0) return;

  const claimed = await prisma.order.updateMany({
    where: { id: orderId, restockedAt: null },
    data: { restockedAt: new Date() },
  });
  if (claimed.count === 0) return;

  try {
    const productIds = [...new Set(lineItems.map((item) => item.productId))];
    const [products, sizes] = await Promise.all([
      prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, inventoryPolicy: true } }),
      prisma.productSize.findMany({
        where: { OR: lineItems.map((item) => ({ productId: item.productId, name: item.size })) },
        select: { id: true, productId: true, name: true },
      }),
    ]);
    const policyById = new Map(products.map((product) => [product.id, product.inventoryPolicy]));
    const sizeIdByKey = new Map(sizes.map((size) => [`${size.productId}:${size.name}`, size.id]));

    const increments = lineItems
      .filter((item) => policyById.get(item.productId) === "deny")
      .map((item) => ({ sizeId: sizeIdByKey.get(`${item.productId}:${item.size}`), quantity: item.quantity }))
      .filter((entry): entry is { sizeId: string; quantity: number } => Boolean(entry.sizeId));

    await prisma.$transaction(
      increments.map(({ sizeId, quantity }) =>
        prisma.productSize.update({ where: { id: sizeId }, data: { quantity: { increment: quantity } } })
      )
    );
  } catch (error) {
    await prisma.order.update({ where: { id: orderId }, data: { restockedAt: null } }).catch(() => {});
    // Surfaced rather than swallowed: unlike a failed email, stock that silently stayed
    // off the shelf is invisible until a customer cannot buy something.
    console.error("Failed to restock order", orderId, error);
  }
}

export async function updateOrderStatus(id: string, status: Order["status"]): Promise<Order> {
  const row = await prisma.order.update({
    where: { id },
    // deliveredAt schedules the post-delivery review-request follow-up (services/email-followups.ts).
    // No status-history table exists, so re-marking an already-delivered order as
    // "delivered" again overwrites it — an accepted edge case, matches this function's
    // existing best-effort philosophy elsewhere.
    data: { status, ...(status === "delivered" ? { deliveredAt: new Date() } : {}) },
  });
  const order = toOrder(row);

  // Before the email, so a mail outage cannot leave the units off the shelf.
  if (STOCK_RETURNING_STATUSES.has(status)) {
    await restockOrderIfNeeded(order.id, order.lineItems);
  }

  // "confirmed" is covered by the order-confirmation email sent at checkout —
  // every other status is a real update worth notifying the customer about.
  // Best-effort: a failed email must never fail the status update itself.
  if (status !== "confirmed") {
    try {
      const settings = await getSiteSettings();
      const message = shippingUpdateEmail({
        siteName: settings.siteName,
        orderId: order.id,
        status,
        lineItems: order.lineItems,
        trackingNumber: order.trackingNumber,
        carrier: order.carrier,
        trackingUrl: order.trackingUrl,
      });
      await getEmailProvider().send({ to: order.customerEmail, template: "shipping-update", ...message });
    } catch (emailError) {
      console.error("Failed to send order status email", emailError);
    }
  }

  return order;
}

export interface OrderTrackingInput {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

export async function updateOrderTracking(id: string, input: OrderTrackingInput): Promise<Order> {
  const row = await prisma.order.update({
    where: { id },
    data: {
      carrier: input.carrier || null,
      trackingNumber: input.trackingNumber || null,
      trackingUrl: input.trackingUrl || null,
    },
  });
  return toOrder(row);
}
