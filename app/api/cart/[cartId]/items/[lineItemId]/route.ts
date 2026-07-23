import { NextResponse, type NextRequest } from "next/server";
import { moveToCart, removeLineItem, saveForLater, updateLineItemQuantity } from "@/services/carts";
import { savedForLaterBodySchema, updateQuantityBodySchema } from "@/lib/validation/commerce";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";

type RouteParams = { params: Promise<{ cartId: string; lineItemId: string }> };

/** Body is either `{ quantity }` or `{ savedForLater }` — consolidates 3 CartService methods (updateLineItemQuantity/saveForLater/moveToCart) into one PATCH route. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { cartId, lineItemId } = await params;
    const body = await request.json();

    const savedForLaterParsed = savedForLaterBodySchema.safeParse(body);
    if (savedForLaterParsed.success) {
      const cart = savedForLaterParsed.data.savedForLater
        ? await saveForLater(cartId, lineItemId)
        : await moveToCart(cartId, lineItemId);
      return NextResponse.json({ cart });
    }

    const quantityParsed = updateQuantityBodySchema.safeParse(body);
    if (!quantityParsed.success) return invalidInputResponse("Provide either { quantity } or { savedForLater }.");
    const cart = await updateLineItemQuantity(cartId, lineItemId, quantityParsed.data.quantity);
    return NextResponse.json({ cart });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { cartId, lineItemId } = await params;
    const cart = await removeLineItem(cartId, lineItemId);
    return NextResponse.json({ cart });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
