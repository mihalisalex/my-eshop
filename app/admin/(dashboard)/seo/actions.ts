"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireCapability } from "@/lib/admin-session";
import { SEO_CACHE_TAG, saveSeoDefaults } from "@/services/seo";
import type { SiteSeoDefaults } from "@/types";

export async function saveSeoDefaultsAction(seo: SiteSeoDefaults): Promise<void> {
  await requireCapability("admin:settings");
  await saveSeoDefaults(seo);
  revalidatePath("/", "layout");
  // Cached in the root layout (PERF-002 tier 1); without this the new title and description
  // would not appear until the TTL expired.
  updateTag(SEO_CACHE_TAG);
}
