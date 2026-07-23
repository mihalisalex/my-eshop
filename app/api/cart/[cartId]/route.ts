import { NextResponse, type NextRequest } from "next/server";
import { clearCart, getCart } from "@/services/carts";
import { commerceErrorResponse } from "@/lib/commerce/http-errors";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ cartId: string }> }) {
  try {
    const { cartId } = await params;
    const cart = await getCart(cartId);
    return NextResponse.json({ cart });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}

/** Empties the cart's line items/discounts/gift-cards; the cart row itself stays. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ cartId: string }> }) {
  try {
    const { cartId } = await params;
    const cart = await clearCart(cartId);
    return NextResponse.json({ cart });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
