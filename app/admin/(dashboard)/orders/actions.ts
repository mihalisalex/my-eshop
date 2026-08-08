"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/admin-session";
import { getOrderById, updateOrderStatus, updateOrderTracking, type OrderTrackingInput } from "@/services/orders";
import { getCourierProvider } from "@/lib/courier";
import type { Order } from "@/lib/commerce/types";

export async function updateOrderStatusAction(orderId: string, status: Order["status"]): Promise<void> {
  await requireCapability("orders:manage");
  await updateOrderStatus(orderId, status);
  revalidatePath("/", "layout");
}

export async function updateOrderTrackingAction(orderId: string, input: OrderTrackingInput): Promise<void> {
  await requireCapability("orders:manage");
  await updateOrderTracking(orderId, input);
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
    revalidatePath("/", "layout");
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't create the shipment." };
  }
}
