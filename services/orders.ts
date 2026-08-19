import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, resolvePage, toPaged, type Paged } from "@/lib/pagination";
import { toOrder } from "@/lib/commerce/postgres/mappers";
import { getEmailProvider, shippingUpdateEmail } from "@/lib/email";
import { getSiteSettings } from "@/services/settings";
import { creditStockForLines, quantitiesCreditedByReturns, subtractCreditedQuantities } from "@/services/restock";
import type { Order } from "@/lib/commerce/types";

export async function getOrderById(id: string): Promise<Order | null> {
  const row = await prisma.order.findUnique({ where: { id } });
  return row ? toOrder(row) : null;
}

export async function getOrdersForCustomer(customerId: string): Promise<Order[]> {
  const rows = await prisma.order.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } });
  return rows.map(toOrder);
}

/**
 * Every order, unpaged — kept for the two screens that genuinely aggregate over the whole
 * set (the dashboard's recent-orders strip and revenue figures, and Analytics). The
 * orders LIST no longer uses it; see `listOrdersForAdmin`. This is the next thing to
 * revisit when order volume grows, since both callers really want SQL aggregates rather
 * than every row in memory.
 */
export async function getAllOrdersForAdmin(): Promise<Order[]> {
  const rows = await prisma.order.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toOrder);
}

export interface AdminOrderQuery {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

/**
 * The admin orders list: filtered, searched and paged in SQL.
 *
 * It used to render every order ever placed, with no search and no status filter, so
 * finding one order meant Ctrl-F over the whole table. Fine at nine orders and unusable
 * at nine hundred — and the fix has to be server-side, because the point is not fetching
 * them all in the first place.
 *
 * Search covers the three things someone actually has to hand: the short order reference
 * a customer quotes (matched against the tail of the id, which is what
 * `orderReference()` renders), the email address, and the name on the shipping label.
 * The name lives inside a Json column, so it is matched with Prisma's `string_contains`
 * on the specific paths rather than by casting the whole document to text — that would
 * also match street names and gift messages, which is a surprising place for a search
 * for "Anna" to land.
 */
export async function listOrdersForAdmin(query: AdminOrderQuery = {}): Promise<Paged<Order>> {
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const search = query.search?.trim();

  const where: Prisma.OrderWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(search
      ? {
          OR: [
            // A customer quotes "#38QLUMG3"; the stored id is the full cuid.
            { id: { endsWith: search.replace(/^#/, "").toLowerCase() } },
            { customerEmail: { contains: search, mode: "insensitive" } },
            { shippingAddress: { path: ["firstName"], string_contains: search, mode: "insensitive" } },
            { shippingAddress: { path: ["lastName"], string_contains: search, mode: "insensitive" } },
            { trackingNumber: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const total = await prisma.order.count({ where });
  const { page, skip, take } = resolvePage(total, { page: query.page ?? 1, pageSize });
  const rows = await prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip, take });

  return toPaged(rows.map(toOrder), total, page, pageSize);
}

/** Status values the filter offers, in fulfilment order. */
export const ORDER_STATUS_FILTERS = ["confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"] as const;

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
 * Only lines whose product denies overselling are restored — see `creditStockForLines`.
 *
 * Units a RETURN on this order has already credited are subtracted first. Without that, a
 * customer returning one item and the shop then refunding the whole order credits that item
 * twice, inventing stock that was never on the shelf. The two paths hold separate claims
 * (`Order.restockedAt` and `Return.restockedAt`) precisely because either can happen first.
 */
async function restockOrderIfNeeded(orderId: string, lineItems: Order["lineItems"]): Promise<void> {
  if (lineItems.length === 0) return;

  const claimed = await prisma.order.updateMany({
    where: { id: orderId, restockedAt: null },
    data: { restockedAt: new Date() },
  });
  if (claimed.count === 0) return;

  try {
    const alreadyCredited = await quantitiesCreditedByReturns(orderId);
    const lines = lineItems.map((item) => ({
      productId: item.productId,
      size: item.size,
      quantity: item.quantity,
    }));

    await creditStockForLines(subtractCreditedQuantities(lines, alreadyCredited));
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
