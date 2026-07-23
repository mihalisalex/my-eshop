"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-session";
import { saveNavigation } from "@/services/navigation";
import type { NavigationConfig } from "@/types";

export async function saveNavigationAction(navigation: NavigationConfig): Promise<void> {
  await requireAdminSession();
  await saveNavigation(navigation);
  revalidatePath("/", "layout");
}
