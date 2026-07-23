import type { Address } from "@/lib/commerce/types";

export interface CreateShipmentInput {
  orderId: string;
  recipientName: string;
  address: Address;
  weightGrams: number;
  itemQuantity: number;
}

export interface CreateShipmentResult {
  trackingNumber: string;
  carrier: string;
  trackingUrl: string;
}

/**
 * Vendor-neutral seam for real courier integrations — same single-factory pattern as
 * `lib/commerce/index.ts`/`lib/email/index.ts`. `createShipment` is the only real-API
 * concern; a manually-entered tracking number (no live API call) is handled entirely
 * in the admin UI/Server Action, not through this interface.
 */
export interface CourierProvider {
  createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult>;
}

export class CourierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourierError";
  }
}
