import { NextResponse } from "next/server";
import { CommerceError } from "@/lib/commerce/types";

/**
 * Shared error->HTTP mapping for every cart/checkout/customer/wishlist/auth
 * Route Handler. Response body shape is always `{ error: { code, message } }`,
 * consumed by lib/commerce/providers/remote/http.ts's fetchJson to reconstruct
 * a CommerceError client-side.
 */
export function commerceErrorResponse(error: unknown): NextResponse {
  if (error instanceof CommerceError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 400 });
  }
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  }
  if (error instanceof Error && /not found/i.test(error.message)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: error.message } }, { status: 404 });
  }
  console.error(error);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } }, { status: 500 });
}

export function invalidInputResponse(message: string): NextResponse {
  return NextResponse.json({ error: { code: "INVALID_INPUT", message } }, { status: 400 });
}

export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again shortly." } },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
