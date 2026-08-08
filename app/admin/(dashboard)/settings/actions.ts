"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/admin-session";
import { saveSiteSettings } from "@/services/settings";
import type { SiteSettings } from "@/types";

export async function saveSiteSettingsAction(settings: SiteSettings): Promise<void> {
  await requireCapability("admin:settings");
  await saveSiteSettings(settings);
  revalidatePath("/", "layout");
}
