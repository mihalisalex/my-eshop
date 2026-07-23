import { NextResponse, type NextRequest } from "next/server";
import { linkCustomerCart } from "@/services/carts";
import { requireCustomerSession } from "@/lib/customer-session";
import { commerceErrorResponse } from "@/lib/commerce/http-errors";

/** Session-gated (unlike every other cart route) — associates this cart with the currently-authenticated customer, resolved server-side, never from a client-supplied id. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ cartId: string }> }) {
  try {
    const session = await requireCustomerSession();
    const { cartId } = await params;
    const cart = await linkCustomerCart(cartId, session.sub);
    return NextResponse.json({ cart });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
