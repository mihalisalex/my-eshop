import { NextResponse, type NextRequest } from "next/server";
import { getCustomerById, updateCustomerProfile } from "@/services/customers";
import { requireCustomerSession } from "@/lib/customer-session";
import { commerceErrorResponse } from "@/lib/commerce/http-errors";
import type { Customer } from "@/lib/commerce/types";

/**
 * Session-gated: identity always comes from the verified cookie, never from a
 * client-supplied customerId. A crafted request passing someone else's
 * customerId is rejected (403), not silently honored — the mock never had to
 * guard against this since localStorage has no "other user" to protect against.
 */
function forbidden() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Not authorized for that customer." } }, { status: 403 });
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireCustomerSession();
    const requestedId = request.nextUrl.searchParams.get("customerId");
    if (requestedId && requestedId !== session.sub) return forbidden();
    const customer = await getCustomerById(session.sub);
    return NextResponse.json({ customer });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireCustomerSession();
    const body = await request.json();
    if (typeof body.customerId === "string" && body.customerId !== session.sub) return forbidden();

    const patch: Partial<Pick<Customer, "firstName" | "lastName" | "phone" | "acceptsMarketing">> = {};
    if (typeof body.firstName === "string") patch.firstName = body.firstName;
    if (typeof body.lastName === "string") patch.lastName = body.lastName;
    if (typeof body.phone === "string") patch.phone = body.phone;
    if (typeof body.acceptsMarketing === "boolean") patch.acceptsMarketing = body.acceptsMarketing;

    const customer = await updateCustomerProfile(session.sub, patch);
    return NextResponse.json({ customer });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
