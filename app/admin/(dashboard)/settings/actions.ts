"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/admin-session";
import { recordAdminAction } from "@/services/audit-log";
import { saveSiteSettings } from "@/services/settings";
import type { SiteSettings } from "@/types";

export async function saveSiteSettingsAction(settings: SiteSettings): Promise<void> {
  await requireCapability("admin:settings");
  await saveSiteSettings(settings);
  /**
   * OBS-003. Settings carry the free-shipping threshold and which delivery options exist —
   * both of which decide what a shopper is charged. The values are NOT copied into the
   * entry: this blob holds contact details and provider configuration, and an audit trail
   * is a poor place to accumulate a second copy of them. The record answers "who changed
   * the settings, and when"; the settings themselves answer what they are now.
   */
  await recordAdminAction({
    action: "settings.updated",
    targetType: "settings",
    targetId: "site",
    summary: "Updated the site settings",
  });
  revalidatePath("/", "layout");
}
