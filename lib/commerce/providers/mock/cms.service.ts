import { getAboutPage } from "@/services/about";
import { getAllCampaigns, getCampaignBySlug } from "@/services/campaigns";
import { getAllLookbooks, getLookbookBySlug } from "@/services/lookbooks";
import { getLandingPageBySlug } from "@/services/landing-pages";
import { fetchJson } from "@/lib/commerce/providers/remote/http";
import type { CMSService } from "@/lib/commerce/types";
import type { BlogPost, HomepageConfig, NavigationConfig, SiteSettings } from "@/types";

/**
 * This file runs in the browser (it's part of `createMockCommerceProvider()`,
 * imported by client components like `WishlistProvider`) — homepage/navigation/
 * settings/blog are Postgres-backed now (see services/*.ts), so they're fetched
 * through Route Handlers here instead of imported directly, same reasoning as
 * every `remote/*.service.ts` file. Nothing in this app actually calls
 * `commerce.cms.*` today (every real page reads the services directly as a
 * Server Component) — these exist for interface completeness, still real.
 */
export function createMockCMSService(): CMSService {
  return {
    async getHomepage() {
      const { homepage } = await fetchJson<{ homepage: HomepageConfig }>("/api/cms/homepage");
      return homepage;
    },
    async getNavigation() {
      const { navigation } = await fetchJson<{ navigation: NavigationConfig }>("/api/cms/navigation");
      return navigation;
    },
    async getSettings() {
      const { settings } = await fetchJson<{ settings: SiteSettings }>("/api/cms/settings");
      return settings;
    },
    async getBlogPosts() {
      const { posts } = await fetchJson<{ posts: BlogPost[] }>("/api/cms/blog");
      return posts;
    },
    async getBlogPost(slug: string) {
      const { post } = await fetchJson<{ post: BlogPost | null }>(`/api/cms/blog/${encodeURIComponent(slug)}`);
      return post ?? null;
    },
    async getAboutPage() {
      return getAboutPage();
    },
    async getCampaigns() {
      return getAllCampaigns();
    },
    async getCampaign(slug: string) {
      const campaign = await getCampaignBySlug(slug);
      return campaign ?? null;
    },
    async getLookbooks() {
      return getAllLookbooks();
    },
    async getLookbook(slug: string) {
      const lookbook = await getLookbookBySlug(slug);
      return lookbook ?? null;
    },
    async getLandingPage(slug: string) {
      const page = await getLandingPageBySlug(slug);
      return page ?? null;
    },
  };
}
