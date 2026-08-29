import { NextResponse, type NextRequest } from "next/server";
import { getAvailablePaymentMethods } from "@/services/payments";
import { resolveCheckoutAmounts } from "@/services/checkout";
import { commerceErrorResponse, invalidInputResponse, rateLimitedResponse } from "@/lib/commerce/http-errors";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

/**
 * The endpoint §20 asks for: the storefront asks the backend what it may offer, and
 * renders exactly that. There is no `if (stripe) … if (cod) …` anywhere in the
 * checkout UI, so enabling a method in the admin changes the storefront on the next
 * request with no deploy and no code change.
 *
 * Everything that decides availability — the totals, the destination, the selected
 * delivery method, each method's own limits — is read server-side from the stored
 * checkout. The caller supplies only a `checkoutId`, which is deliberate: if the
 * amount came from the query string, a shopper could ask for the method list (and
 * the fee) for a total they invented.
 */
export async function GET(request: NextRequest) {
  const checkoutId = request.nextUrl.searchParams.get("checkoutId");
  if (!checkoutId) return invalidInputResponse("checkoutId is required.");

  try {
    // `checkoutId` is a capability token exactly like `cartId` elsewhere in this
    // app — unguessable and scoped to one purchase — so this route is
    // unauthenticated by the same reasoning as the checkout PATCH route, and
    // rate-limited by IP for the same reason: to bound abuse of an endpoint that
    // does real database work, without punishing a shopper who legitimately
    // re-fetches on every address, delivery and gift-wrap change.
    const ip = getClientIp(request.headers);
    const key = `payment-methods:ip:${ip}`;
    const limit = await isRateLimited({ key, limit: 120, windowMs: 10 * 60 * 1000 });
    if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);
    await recordAttempt(key);

    const { checkoutRow, totals, shippingRate, cart } = await resolveCheckoutAmounts(checkoutId);

    const shippingAddress = checkoutRow.shippingAddress as { countryCode?: string } | null;
    const methods = await getAvailablePaymentMethods({
      amount: totals.total.amount,
      currencyCode: cart.currencyCode,
      countryCode: shippingAddress?.countryCode,
      shippingRateId: shippingRate?.id,
    });

    return NextResponse.json(
      {
        // The total the fees below were computed against, so the client can show
        // "€X + €2.00 = €Y" without doing any money arithmetic of its own.
        baseTotal: totals.total,
        selectedMethodId: checkoutRow.paymentMethodId ?? null,
        methods,
      },
      // Payment availability is per-checkout and changes the moment an admin
      // toggles a method — caching it, even briefly, would show a shopper a
      // method that has just been switched off.
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
