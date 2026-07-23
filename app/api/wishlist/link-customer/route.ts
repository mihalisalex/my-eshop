import { NextResponse, type NextRequest } from "next/server";
import { linkWishlistToCustomer } from "@/services/wishlists";
import { requireCustomerSession } from "@/lib/customer-session";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";

export async function POST(request: NextRequest) {
  try {
    const session = await requireCustomerSession();
    const body = await request.json();
    if (typeof body?.anonymousId !== "string") return invalidInputResponse("anonymousId is required.");
    const wishlist = await linkWishlistToCustomer(body.anonymousId, session.sub);
    return NextResponse.json({ wishlist });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
