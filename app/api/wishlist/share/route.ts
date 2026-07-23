import { NextResponse, type NextRequest } from "next/server";
import { getOrCreateShareToken } from "@/services/wishlists";
import { getCustomerSession } from "@/lib/customer-session";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";

export async function POST(request: NextRequest) {
  try {
    const session = await getCustomerSession();
    const ownerId = request.nextUrl.searchParams.get("ownerId");
    const identity = session ? { customerId: session.sub } : { anonymousId: ownerId ?? undefined };
    if (!identity.customerId && !identity.anonymousId) return invalidInputResponse("ownerId is required for guests.");

    const shareToken = await getOrCreateShareToken(identity);
    return NextResponse.json({ shareToken });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
