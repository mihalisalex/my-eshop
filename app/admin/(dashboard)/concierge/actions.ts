"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/admin-session";
import { updateConciergeRequestStatus } from "@/services/concierge";
import type { ConciergeRequest } from "@/services/concierge";

export async function updateConciergeStatusAction(id: string, status: ConciergeRequest["status"]): Promise<void> {
  await requireCapability("orders:manage");
  await updateConciergeRequestStatus(id, status);
  revalidatePath("/admin/concierge");
}
