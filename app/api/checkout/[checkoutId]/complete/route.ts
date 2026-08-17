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
    // `payment`/`customerAction` are provider-agnostic by construction — the client
    // learns "redirect here" or "show these instructions", never which vendor is
    // behind them. See CompleteCheckoutResult in lib/commerce/types.ts.
    const result = await completeCheckout(checkoutId);
    return NextResponse.json(result);
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
