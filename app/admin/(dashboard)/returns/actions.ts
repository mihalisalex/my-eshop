"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-session";
import { updateReturnStatus } from "@/services/returns";
import type { Return } from "@/lib/commerce/types";

export async function updateReturnStatusAction(returnId: string, status: Return["status"]): Promise<void> {
  await requireAdminSession();
  await updateReturnStatus(returnId, status);
  revalidatePath("/", "layout");
}
