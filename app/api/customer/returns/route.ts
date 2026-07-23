import { NextResponse } from "next/server";
import { createReturn, getReturnsForCustomer } from "@/services/returns";
import { requireCustomerSession } from "@/lib/customer-session";
import { createReturnInputSchema } from "@/lib/validation/commerce";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";

export async function GET() {
  try {
    const session = await requireCustomerSession();
    const returns = await getReturnsForCustomer(session.sub);
    return NextResponse.json({ returns });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}

/** Ignores any client-supplied customerId — identity always comes from the verified session cookie, same rule as every other /api/customer/* route. */
export async function POST(request: Request) {
  try {
    const session = await requireCustomerSession();
    const body = await request.json();
    const parsed = createReturnInputSchema.safeParse(body);
    if (!parsed.success) return invalidInputResponse(parsed.error.issues[0]?.message ?? "Invalid input.");

    const created = await createReturn({
      orderId: parsed.data.orderId,
      customerId: session.sub,
      items: parsed.data.items,
      reason: parsed.data.reason,
    });
    return NextResponse.json({ return: created });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
