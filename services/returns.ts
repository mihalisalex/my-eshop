import "server-only";
import { prisma } from "@/lib/prisma";
import { toJsonInput, toReturn } from "@/lib/commerce/postgres/mappers";
import { getEmailProvider, returnStatusUpdateEmail } from "@/lib/email";
import { getSiteSettings } from "@/services/settings";
import { CommerceError, type Return, type ReturnItem } from "@/lib/commerce/types";

export async function createReturn(input: {
  orderId: string;
  customerId: string;
  items: ReturnItem[];
  reason: string;
}): Promise<Return> {
  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new CommerceError("CART_NOT_FOUND", "Order not found.");
  if (order.customerId !== input.customerId) throw new Error("Unauthorized");

  const row = await prisma.return.create({
    data: {
      orderId: input.orderId,
      customerId: input.customerId,
      customerEmail: order.customerEmail,
      items: toJsonInput(input.items),
      reason: input.reason,
    },
  });
  return toReturn(row);
}

export async function getReturnsForCustomer(customerId: string): Promise<Return[]> {
  const rows = await prisma.return.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } });
  return rows.map(toReturn);
}

export async function getAllReturnsForAdmin(): Promise<Return[]> {
  const rows = await prisma.return.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toReturn);
}

export async function updateReturnStatus(id: string, status: Return["status"]): Promise<Return> {
  const row = await prisma.return.update({ where: { id }, data: { status } });
  const returnRow = toReturn(row);

  // "requested" is the initial state the customer already saw when they submitted —
  // every other status is a real update worth notifying about. Best-effort, same
  // pattern as updateOrderStatus.
  if (status !== "requested") {
    try {
      const settings = await getSiteSettings();
      const message = returnStatusUpdateEmail({ siteName: settings.siteName, orderId: returnRow.orderId, status });
      await getEmailProvider().send({ to: returnRow.customerEmail, template: "return-status-update", ...message });
    } catch (emailError) {
      console.error("Failed to send return status email", emailError);
    }
  }

  return returnRow;
}
