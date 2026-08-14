"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/admin-session";
import { updateReturnStatus } from "@/services/returns";
import type { Return } from "@/lib/commerce/types";

export async function updateReturnStatusAction(returnId: string, status: Return["status"]): Promise<void> {
  await requireCapability("orders:returns");
  await updateReturnStatus(returnId, status);
  revalidatePath("/", "layout");
}
