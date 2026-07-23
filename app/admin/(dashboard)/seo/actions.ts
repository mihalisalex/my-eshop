"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-session";
import { saveSeoDefaults } from "@/services/seo";
import type { SiteSeoDefaults } from "@/types";

export async function saveSeoDefaultsAction(seo: SiteSeoDefaults): Promise<void> {
  await requireAdminSession();
  await saveSeoDefaults(seo);
  revalidatePath("/", "layout");
}
