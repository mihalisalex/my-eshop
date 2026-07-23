import { NextResponse, type NextRequest } from "next/server";
import { getRecommendations } from "@/services/carts";
import { commerceErrorResponse } from "@/lib/commerce/http-errors";

export async function GET(request: NextRequest, { params }: { params: Promise<{ cartId: string }> }) {
  try {
    const { cartId } = await params;
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "4");
    const products = await getRecommendations(cartId, limit);
    return NextResponse.json({ products });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
