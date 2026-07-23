import { NextResponse, type NextRequest } from "next/server";
import { addLineItem } from "@/services/carts";
import { addLineItemInputSchema } from "@/lib/validation/commerce";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";

export async function POST(request: NextRequest, { params }: { params: Promise<{ cartId: string }> }) {
  try {
    const { cartId } = await params;
    const parsed = addLineItemInputSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInputResponse(parsed.error.issues[0]?.message ?? "Invalid input.");
    const cart = await addLineItem(cartId, parsed.data);
    return NextResponse.json({ cart });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
