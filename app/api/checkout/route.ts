import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createCheckout } from "@/services/checkout";
import { grantCheckoutAccess } from "@/lib/checkout-access";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";

export async function POST(request: Request) {
  try {
    // Creates a Checkout row per call.
    const limited = await enforceRateLimit(request, { name: "checkout-create", limit: 40, windowMs: 600000 });
    if (limited) return limited;

    const body = await request.json();
    if (typeof body?.cartId !== "string") return invalidInputResponse("cartId is required.");
    const checkout = await createCheckout(body.cartId);
    // From here on, only this browser may read or modify it (SEC-001).
    await grantCheckoutAccess(checkout.id);
    return NextResponse.json({ checkout });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
