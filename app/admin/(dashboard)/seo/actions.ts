"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/admin-session";
import { saveSeoDefaults } from "@/services/seo";
import type { SiteSeoDefaults } from "@/types";

export async function saveSeoDefaultsAction(seo: SiteSeoDefaults): Promise<void> {
  await requireCapability("admin:settings");
  await saveSeoDefaults(seo);
  revalidatePath("/", "layout");
}
