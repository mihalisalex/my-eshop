import aboutData from "@/data/about.json";
import type { AboutPageContent } from "@/types";

const about = aboutData as AboutPageContent;

export async function getAboutPage(): Promise<AboutPageContent> {
  return about;
}
