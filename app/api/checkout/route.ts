import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createCheckout } from "@/services/checkout";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";

export async function POST(request: Request) {
  try {
    // Creates a Checkout row per call.
    const limited = await enforceRateLimit(request, { name: "checkout-create", limit: 40, windowMs: 600000 });
    if (limited) return limited;

    const body = await request.json();
    if (typeof body?.cartId !== "string") return invalidInputResponse("cartId is required.");
    const checkout = await createCheckout(body.cartId);
    return NextResponse.json({ checkout });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
