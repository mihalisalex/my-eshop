import { NextResponse, type NextRequest } from "next/server";
import { getOrdersForCustomer } from "@/services/orders";
import { requireCustomerSession } from "@/lib/customer-session";
import { commerceErrorResponse } from "@/lib/commerce/http-errors";
import { getTranslations } from "next-intl/server";

export async function GET(request: NextRequest) {
  try {
    const session = await requireCustomerSession();
    const requestedId = request.nextUrl.searchParams.get("customerId");
    if (requestedId && requestedId !== session.sub) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: (await getTranslations("ApiErrors"))("notAuthorized") } }, { status: 403 });
    }
    const orders = await getOrdersForCustomer(session.sub);
    return NextResponse.json({ orders });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
