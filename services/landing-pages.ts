import landingPagesData from "@/data/landing-pages.json";
import type { LandingPage } from "@/types";

const landingPages = landingPagesData as LandingPage[];

export async function getLandingPageBySlug(slug: string): Promise<LandingPage | undefined> {
  return landingPages.find((p) => p.slug === slug);
}
