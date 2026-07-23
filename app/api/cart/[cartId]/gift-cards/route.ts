import { NextResponse, type NextRequest } from "next/server";
import { applyGiftCard, removeGiftCard } from "@/services/carts";
import { codeBodySchema } from "@/lib/validation/commerce";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";

type RouteParams = { params: Promise<{ cartId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { cartId } = await params;
    const parsed = codeBodySchema.safeParse(await request.json());
    if (!parsed.success) return invalidInputResponse("A gift card code is required.");
    const cart = await applyGiftCard(cartId, parsed.data.code);
    return NextResponse.json({ cart });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { cartId } = await params;
    const code = request.nextUrl.searchParams.get("code");
    if (!code) return invalidInputResponse("A gift card code is required.");
    const cart = await removeGiftCard(cartId, code);
    return NextResponse.json({ cart });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
