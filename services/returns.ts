import "server-only";
import { prisma } from "@/lib/prisma";
import { toJsonInput, toReturn } from "@/lib/commerce/postgres/mappers";
import { getEmailProvider, returnStatusUpdateEmail } from "@/lib/email";
import { getSiteSettings } from "@/services/settings";
import { creditStockForLines } from "@/services/restock";
import { CommerceError, type Return, type ReturnItem } from "@/lib/commerce/types";

export async function createReturn(input: {
  orderId: string;
  customerId: string;
  items: ReturnItem[];
  reason: string;
}): Promise<Return> {
  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new CommerceError("CART_NOT_FOUND", "Order not found.");
  if (order.customerId !== input.customerId) throw new Error("Unauthorized");

  const row = await prisma.return.create({
    data: {
      orderId: input.orderId,
      customerId: input.customerId,
      customerEmail: order.customerEmail,
      items: toJsonInput(input.items),
      reason: input.reason,
    },
  });
  return toReturn(row);
}

export async function getReturnsForCustomer(customerId: string): Promise<Return[]> {
  const rows = await prisma.return.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } });
  return rows.map(toReturn);
}

export async function getAllReturnsForAdmin(): Promise<Return[]> {
  const rows = await prisma.return.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toReturn);
}

/**
 * The statuses that mean the goods are physically back with the shop.
 *
 * "received" is the honest trigger — that is the moment the units exist on the shelf again.
 * "refunded" is included because nothing forces an admin to pass through "received" first,
 * and a shop that has refunded a customer has certainly accepted the goods back. Whichever
 * arrives first wins the claim; the second is a no-op.
 *
 * "approved" is deliberately NOT here. Approving a return authorises the customer to send
 * the item back — the shop does not have it yet, and crediting stock then would offer for
 * sale a pair of shoes still in a customer's hallway.
 */
const STOCK_RETURNING_RETURN_STATUSES = new Set<Return["status"]>(["received", "refunded"]);

/**
 * Puts a return's units back into `ProductSize.quantity`.
 *
 * QA-063: until now nothing did. The order-level path (services/orders.ts) covered
 * cancellations and refunds of a WHOLE order, but a return is a subset of one and went
 * through a different status field entirely, so returned goods never came back on sale.
 *
 * Claimed with a null-guarded `updateMany` before any stock is written, so two concurrent
 * status changes — or an admin re-saving an already-received return — cannot both credit the
 * same units. If the credit then fails, the claim is released so a later attempt can retry.
 *
 * Skipped entirely when the ORDER has already been restocked: that path credited every line
 * on the order, including these, and crediting again would invent stock.
 */
async function restockReturnIfNeeded(returnId: string, orderId: string, items: ReturnItem[]): Promise<void> {
  if (items.length === 0) return;

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { restockedAt: true } });
  if (order?.restockedAt) return;

  const claimed = await prisma.return.updateMany({
    where: { id: returnId, restockedAt: null },
    data: { restockedAt: new Date() },
  });
  if (claimed.count === 0) return;

  try {
    await creditStockForLines(items.map((item) => ({ productId: item.productId, size: item.size, quantity: item.quantity })));
  } catch (error) {
    await prisma.return.update({ where: { id: returnId }, data: { restockedAt: null } }).catch(() => {});
    // Surfaced rather than swallowed: stock that silently stayed off the shelf is invisible
    // until a customer cannot buy something.
    console.error("Failed to restock return", returnId, error);
  }
}

export async function updateReturnStatus(id: string, status: Return["status"]): Promise<Return> {
  const row = await prisma.return.update({ where: { id }, data: { status } });
  const returnRow = toReturn(row);

  // Before the email, so a mail outage cannot leave the units off the shelf.
  if (STOCK_RETURNING_RETURN_STATUSES.has(status)) {
    await restockReturnIfNeeded(returnRow.id, returnRow.orderId, returnRow.items);
  }

  // "requested" is the initial state the customer already saw when they submitted —
  // every other status is a real update worth notifying about. Best-effort, same
  // pattern as updateOrderStatus.
  if (status !== "requested") {
    try {
      const settings = await getSiteSettings();
      const message = returnStatusUpdateEmail({ siteName: settings.siteName, orderId: returnRow.orderId, status });
      await getEmailProvider().send({ to: returnRow.customerEmail, template: "return-status-update", ...message });
    } catch (emailError) {
      console.error("Failed to send return status email", emailError);
    }
  }

  return returnRow;
}
