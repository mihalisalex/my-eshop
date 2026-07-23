import "server-only";
import settingsFallback from "@/data/settings.json";
import { getSiteContent, setSiteContent } from "@/lib/site-content";
import type { SiteSettings } from "@/types";

export async function getSiteSettings(): Promise<SiteSettings> {
  return getSiteContent<SiteSettings>("settings", settingsFallback as SiteSettings);
}

export async function saveSiteSettings(settings: SiteSettings): Promise<void> {
  await setSiteContent<SiteSettings>("settings", settings);
}
