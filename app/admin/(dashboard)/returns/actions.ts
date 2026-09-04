"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/admin-session";
import { recordAdminAction } from "@/services/audit-log";
import { updateReturnStatus } from "@/services/returns";
import type { Return } from "@/lib/commerce/types";

export async function updateReturnStatusAction(returnId: string, status: Return["status"]): Promise<void> {
  await requireCapability("orders:returns");
  await updateReturnStatus(returnId, status);
  // OBS-003. Approving a return is the decision a refund follows from, so the trail would
  // otherwise show money going back with no record of who authorised it.
  await recordAdminAction({
    action: "return.status_changed",
    targetType: "return",
    targetId: returnId,
    summary: `Set return status to ${status}`,
    metadata: { status },
  });
  revalidatePath("/", "layout");
}
