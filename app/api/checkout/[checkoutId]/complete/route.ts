import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { completeCheckout } from "@/services/checkout";
import { grantOrderAccess } from "@/lib/order-access-cookie";
import { canAccessCheckout } from "@/lib/checkout-access";
import { commerceErrorResponse } from "@/lib/commerce/http-errors";

/**
 * Body may include a client-supplied `cart` for interface-shape parity
 * (CheckoutService.completeCheckout(checkoutId, cart)) — it is intentionally
 * ignored. The server always re-fetches the authoritative cart from Postgres
 * rather than trusting anything the client sent, since this is the one
 * operation with real financial consequences (stock decrement, gift-card
 * balance decrement, Order creation).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ checkoutId: string }> }) {
  try {
    // Order creation: decrements stock, debits gift cards, starts a payment. The one endpoint here with real financial consequences, and it had no limit at all.
    const limited = await enforceRateLimit(request, { name: "checkout-complete", limit: 20, windowMs: 600000 });
    if (limited) return limited;

    const { checkoutId } = await params;

    // Same grant as the PATCH above (SEC-001). This is the endpoint that decrements stock,
    // debits gift cards and starts a payment, so a stranger holding an id must not reach it.
    if (!(await canAccessCheckout(checkoutId))) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Checkout not found." } }, { status: 404 });
    }

    // `payment`/`customerAction` are provider-agnostic by construction — the client
    // learns "redirect here" or "show these instructions", never which vendor is
    // behind them. See CompleteCheckoutResult in lib/commerce/types.ts.
    const result = await completeCheckout(checkoutId);

    // This is the only moment we can know, first-hand, that this browser placed this order —
    // so it is where the confirmation page's authority comes from. Without it the page would
    // be back to trusting the order id in the URL (QA-041). Best-effort: a cookie failure
    // must never fail an order that has already taken stock and started a payment; the
    // shopper would then see "order not found" for an order that exists and is paid.
    try {
      await grantOrderAccess(result.order.id);
    } catch (grantError) {
      console.error("Failed to grant order access", result.order.id, grantError);
    }

    return NextResponse.json(result);
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
