import { NextResponse, type NextRequest } from "next/server";
import { removeCustomerAddress, updateCustomerAddress } from "@/services/customers";
import { requireCustomerSession } from "@/lib/customer-session";
import { addressSchema } from "@/lib/validation/checkout";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";

type RouteParams = { params: Promise<{ addressId: string }> };

/** services/customers.ts's requireOwnAddress guards ownership (404s a crafted request against someone else's addressId) even though the session already scopes to this customer — belt-and-suspenders against an addressId typo/collision. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireCustomerSession();
    const { addressId } = await params;
    const parsed = addressSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInputResponse(parsed.error.issues[0]?.message ?? "Invalid address.");
    const customer = await updateCustomerAddress(session.sub, addressId, parsed.data);
    return NextResponse.json({ customer });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireCustomerSession();
    const { addressId } = await params;
    const customer = await removeCustomerAddress(session.sub, addressId);
    return NextResponse.json({ customer });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
