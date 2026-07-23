import { NextResponse, type NextRequest } from "next/server";
import { setGiftWrap, setShippingRate, updateBillingAddress, updateEmail, updateShippingAddress } from "@/services/checkout";
import { commerceErrorResponse, invalidInputResponse, rateLimitedResponse } from "@/lib/commerce/http-errors";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";
import type { Checkout } from "@/lib/commerce/types";

/**
 * Real PATCH-partial-update semantics — consolidates 4 CheckoutService methods
 * (updateEmail/updateShippingAddress/updateBillingAddress/setShippingRate) into
 * one route; the body may include any subset of {email, shippingAddress,
 * billingAddress, shippingRateId}, applied in that order.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ checkoutId: string }> }) {
  try {
    // Unauthenticated by design (checkoutId is a capability token, same as cart id) —
    // rate-limited by IP to bound abuse rather than by identity. Generous: a real
    // shopper legitimately calls this several times walking through contact/shipping/
    // billing/delivery, plus edits.
    const ip = getClientIp(request.headers);
    const key = `checkout-patch:ip:${ip}`;
    const limit = await isRateLimited({ key, limit: 60, windowMs: 10 * 60 * 1000 });
    if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);
    await recordAttempt(key);

    const { checkoutId } = await params;
    const body = await request.json();
    let checkout: Checkout | undefined;

    if (typeof body.email === "string") checkout = await updateEmail(checkoutId, body.email);
    if (body.shippingAddress) checkout = await updateShippingAddress(checkoutId, body.shippingAddress);
    if (body.billingAddress) checkout = await updateBillingAddress(checkoutId, body.billingAddress);
    if (typeof body.shippingRateId === "string") checkout = await setShippingRate(checkoutId, body.shippingRateId);
    if (typeof body.giftWrap === "boolean") checkout = await setGiftWrap(checkoutId, body.giftWrap, body.giftMessage);

    if (!checkout) return invalidInputResponse("Body must include at least one of email, shippingAddress, billingAddress, shippingRateId, giftWrap.");
    return NextResponse.json({ checkout });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
