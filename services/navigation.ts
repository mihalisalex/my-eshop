import "server-only";
import navigationFallback from "@/data/navigation.json";
import { getSiteContent, setSiteContent } from "@/lib/site-content";
import type { NavigationConfig } from "@/types";

export async function getNavigation(): Promise<NavigationConfig> {
  return getSiteContent<NavigationConfig>("navigation", navigationFallback as NavigationConfig);
}

export async function saveNavigation(navigation: NavigationConfig): Promise<void> {
  await setSiteContent<NavigationConfig>("navigation", navigation);
}
