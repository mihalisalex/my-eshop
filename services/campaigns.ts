import campaignsData from "@/data/campaigns.json";
import type { Campaign } from "@/types";

const campaigns = campaignsData as Campaign[];

export async function getAllCampaigns(): Promise<Campaign[]> {
  return campaigns;
}

export async function getCampaignBySlug(slug: string): Promise<Campaign | undefined> {
  return campaigns.find((c) => c.slug === slug);
}
