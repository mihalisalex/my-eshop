import "server-only";
import { CourierError, type CourierProvider } from "@/lib/courier/types";

/**
 * Default provider — no live API call. The admin types a tracking number/carrier
 * directly into the order's tracking form (see OrderTrackingForm/updateOrderTrackingAction);
 * this provider only exists so `createShipment` has a defined (loud, not silent) failure
 * mode if something ever calls it while COURIER_PROVIDER isn't "acs".
 */
export function createManualCourierProvider(): CourierProvider {
  return {
    async createShipment() {
      throw new CourierError("Manual courier mode is active — enter a tracking number directly, no live shipment is created.");
    },
  };
}
