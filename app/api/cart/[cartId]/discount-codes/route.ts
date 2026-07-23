import { NextResponse, type NextRequest } from "next/server";
import { applyDiscountCode, removeDiscountCode } from "@/services/carts";
import { codeBodySchema } from "@/lib/validation/commerce";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";

type RouteParams = { params: Promise<{ cartId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { cartId } = await params;
    const parsed = codeBodySchema.safeParse(await request.json());
    if (!parsed.success) return invalidInputResponse("A discount code is required.");
    const cart = await applyDiscountCode(cartId, parsed.data.code);
    return NextResponse.json({ cart });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { cartId } = await params;
    const code = request.nextUrl.searchParams.get("code");
    if (!code) return invalidInputResponse("A discount code is required.");
    const cart = await removeDiscountCode(cartId, code);
    return NextResponse.json({ cart });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
