import "server-only";
import seoFallback from "@/data/seo.json";
import { getSiteContent, setSiteContent } from "@/lib/site-content";
import type { SiteSeoDefaults } from "@/types";

export async function getSeoDefaults(): Promise<SiteSeoDefaults> {
  return getSiteContent<SiteSeoDefaults>("seo", seoFallback as SiteSeoDefaults);
}

export async function saveSeoDefaults(seo: SiteSeoDefaults): Promise<void> {
  await setSiteContent<SiteSeoDefaults>("seo", seo);
}
