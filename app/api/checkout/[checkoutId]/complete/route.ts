import { NextResponse, type NextRequest } from "next/server";
import { completeCheckout } from "@/services/checkout";
import { commerceErrorResponse } from "@/lib/commerce/http-errors";

/**
 * Body may include a client-supplied `cart` for interface-shape parity
 * (CheckoutService.completeCheckout(checkoutId, cart)) — it is intentionally
 * ignored. The server always re-fetches the authoritative cart from Postgres
 * rather than trusting anything the client sent, since this is the one
 * operation with real financial consequences (stock decrement, gift-card
 * balance decrement, Order creation).
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ checkoutId: string }> }) {
  try {
    const { checkoutId } = await params;
    const order = await completeCheckout(checkoutId);
    return NextResponse.json({ order });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
