import "server-only";
import homepageFallback from "@/data/homepage.json";
import { getSiteContent, setSiteContent } from "@/lib/site-content";
import type { HomepageConfig, HomepageSection } from "@/types";

export async function getHomepageConfig(): Promise<HomepageConfig> {
  return getSiteContent<HomepageConfig>("homepage", homepageFallback as HomepageConfig);
}

/** Enabled sections, sorted for rendering — this is the exact ordering the admin editor mutates. */
export async function getVisibleHomepageSections(): Promise<HomepageSection[]> {
  const homepage = await getHomepageConfig();
  return [...homepage.sections]
    .filter((section) => section.enabled)
    .sort((a, b) => a.order - b.order);
}

export async function saveHomepageSections(sections: HomepageSection[]): Promise<void> {
  await setSiteContent<HomepageConfig>("homepage", { sections });
}
