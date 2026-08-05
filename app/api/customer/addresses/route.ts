import { NextResponse, type NextRequest } from "next/server";
import { addCustomerAddress } from "@/services/customers";
import { requireCustomerSession } from "@/lib/customer-session";
import { addressSchema } from "@/lib/validation/checkout";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";

export async function POST(request: NextRequest) {
  try {
    const session = await requireCustomerSession();
    const parsed = addressSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInputResponse(parsed.error.issues[0]?.message ?? "Invalid address.");
    const customer = await addCustomerAddress(session.sub, parsed.data);
    return NextResponse.json({ customer });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
