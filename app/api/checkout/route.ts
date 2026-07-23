import { NextResponse } from "next/server";
import { createCheckout } from "@/services/checkout";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body?.cartId !== "string") return invalidInputResponse("cartId is required.");
    const checkout = await createCheckout(body.cartId);
    return NextResponse.json({ checkout });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
