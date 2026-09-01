import { NextResponse } from "next/server";
import { CommerceError } from "@/lib/commerce/types";
import { PaymentError } from "@/lib/payments/types";

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
  // A PaymentError's `message` is written for the audit log and can name provider
  // internals or configuration state — only `publicMessage` is ever sent to a
  // shopper. The real one is logged server-side instead.
  if (error instanceof PaymentError) {
    console.error("[payments]", error.code, error.message);
    return NextResponse.json({ error: { code: error.code, message: error.publicMessage } }, { status: 400 });
  }
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  }
  /**
   * Matched on message text, which is fragile, so the message itself is NOT echoed back.
   *
   * Two things reach this branch that were never meant to. Prisma's P2025 reads "An
   * operation failed because it depends on one or more records that were required but not
   * found" — it matches, so any update or delete against a missing row was answering with
   * Prisma's own wording, which names the operation. And any internal invariant phrased
   * with those two words was being downgraded from a 500 to a 404 and quoted verbatim.
   *
   * The status stays 404, because the one case this legitimately serves (an address id that
   * is not the caller's, from services/customers.ts) really is not found. What changes is
   * that the client is told only that, and the real text goes to the log.
   */
  if (error instanceof Error && /not found/i.test(error.message)) {
    console.error("[not-found]", error.message);
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found." } }, { status: 404 });
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
