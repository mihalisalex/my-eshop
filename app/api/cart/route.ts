import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getOrCreateCart } from "@/services/carts";
import { commerceErrorResponse } from "@/lib/commerce/http-errors";

/** Cart is capability-token-only (see app/api/wishlist/route.ts's doc comment for the contrast) — the id itself authorizes every operation, exactly like the old localStorage model. No session check here or on any other cart route. */
export async function GET(request: NextRequest) {
  try {
    // getOrCreateCart INSERTs whenever the id is absent or unknown — 89 guest carts accumulated during normal use.
    const limited = await enforceRateLimit(request, { name: "cart-create", limit: 60, windowMs: 600000 });
    if (limited) return limited;

    const cartId = request.nextUrl.searchParams.get("cartId");
    const cart = await getOrCreateCart(cartId);
    return NextResponse.json({ cart });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
