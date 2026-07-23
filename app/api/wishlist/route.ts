import { NextResponse, type NextRequest } from "next/server";
import { addWishlistItem, getWishlistByOwner, removeWishlistItem, type WishlistIdentity } from "@/services/wishlists";
import { getCustomerSession } from "@/lib/customer-session";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";

/**
 * Identity-resolution rule (asymmetric with Cart on purpose): if a valid
 * customer session cookie is present, every handler here ignores any
 * client-supplied ownerId and resolves the wishlist via customerId instead —
 * only falling back to the supplied ownerId (an anonymous capability token,
 * same trust model as Cart) when there is no valid session. This means
 * WishlistProvider's normal get/add/remove calls need zero auth-awareness —
 * the server transparently resolves the right wishlist either way.
 */
async function resolveIdentity(request: NextRequest): Promise<WishlistIdentity> {
  const session = await getCustomerSession();
  if (session) return { customerId: session.sub };
  const ownerId = request.nextUrl.searchParams.get("ownerId");
  return { anonymousId: ownerId ?? undefined };
}

export async function GET(request: NextRequest) {
  try {
    const identity = await resolveIdentity(request);
    if (!identity.customerId && !identity.anonymousId) return invalidInputResponse("ownerId is required for guests.");
    const wishlist = await getWishlistByOwner(identity);
    return NextResponse.json({ wishlist });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await resolveIdentity(request);
    if (!identity.customerId && !identity.anonymousId) return invalidInputResponse("ownerId is required for guests.");
    const body = await request.json();
    if (typeof body?.productId !== "string") return invalidInputResponse("productId is required.");
    const wishlist = await addWishlistItem(identity, body.productId);
    return NextResponse.json({ wishlist });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const identity = await resolveIdentity(request);
    if (!identity.customerId && !identity.anonymousId) return invalidInputResponse("ownerId is required for guests.");
    const productId = request.nextUrl.searchParams.get("productId");
    if (!productId) return invalidInputResponse("productId is required.");
    const wishlist = await removeWishlistItem(identity, productId);
    return NextResponse.json({ wishlist });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
