import { NextResponse, type NextRequest } from "next/server";
import { estimateShipping } from "@/services/carts";
import { commerceErrorResponse } from "@/lib/commerce/http-errors";

export async function POST(request: NextRequest, { params }: { params: Promise<{ cartId: string }> }) {
  try {
    const { cartId } = await params;
    const body = await request.json().catch(() => ({}));
    const rates = await estimateShipping(cartId, body?.address);
    return NextResponse.json({ rates });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
