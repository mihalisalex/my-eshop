"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/admin-session";
import { recordAdminAction } from "@/services/audit-log";
import { getOrderById, updateOrderStatus, updateOrderTracking, type OrderTrackingInput } from "@/services/orders";
import { getCourierProvider } from "@/lib/courier";
import type { Order } from "@/lib/commerce/types";

export async function updateOrderStatusAction(orderId: string, status: Order["status"]): Promise<void> {
  await requireCapability("orders:manage");
  await updateOrderStatus(orderId, status);
  /**
   * OBS-003. `order.status_changed` was declared in the audit vocabulary from the start and
   * never written by anything — the verb existed, the record did not. Altering an order
   * after a customer has paid for it is exactly the case the trail is for: it is the
   * difference between "we marked it delivered" and "the customer says it never arrived".
   */
  await recordAdminAction({
    action: "order.status_changed",
    targetType: "order",
    targetId: orderId,
    summary: `Set order status to ${status}`,
    metadata: { status },
  });
  revalidatePath("/", "layout");
}

export async function updateOrderTrackingAction(orderId: string, input: OrderTrackingInput): Promise<void> {
  await requireCapability("orders:manage");
  await updateOrderTracking(orderId, input);
  await recordAdminAction({
    action: "order.tracking_updated",
    targetType: "order",
    targetId: orderId,
    summary: input.trackingNumber
      ? `Set tracking to ${input.trackingNumber}`
      : "Cleared the tracking number",
    metadata: { ...input },
  });
  revalidatePath("/", "layout");
}

export interface CreateShipmentActionState {
  error?: string;
}

/**
 * Calls the real ACS API when COURIER_PROVIDER=acs (see lib/courier) — an actual
 * live shipment/voucher, not a no-op. Only reachable from the admin order detail
 * page's button, which is itself only rendered when ACS is configured.
 */
export async function createAcsShipmentAction(orderId: string): Promise<CreateShipmentActionState> {
  await requireCapability("orders:manage");
  try {
    const order = await getOrderById(orderId);
    if (!order) return { error: "Order not found." };

    const totalQuantity = order.lineItems.reduce((sum, item) => sum + item.quantity, 0);
    const provider = getCourierProvider();
    const result = await provider.createShipment({
      orderId: order.id,
      recipientName: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
      address: order.shippingAddress,
      // Order snapshots don't carry per-line-item weight — a reasonable flat
      // estimate per unit until real per-product shipping weight is threaded
      // through the cart/order snapshot.
      weightGrams: Math.max(500, totalQuantity * 500),
      itemQuantity: totalQuantity,
    });

    await updateOrderTracking(orderId, result);
    // This one really did dispatch a courier voucher against the shop's ACS account, so it
    // costs money whether or not the parcel is ever sent.
    await recordAdminAction({
      action: "order.shipment_created",
      targetType: "order",
      targetId: orderId,
      summary: `Created an ACS shipment${result.trackingNumber ? ` (${result.trackingNumber})` : ""}`,
      metadata: { ...result },
    });
    revalidatePath("/", "layout");
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't create the shipment." };
  }
}
