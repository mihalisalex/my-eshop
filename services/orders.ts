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
