import trendingSearchesData from "@/data/trending-searches.json";

const trendingSearches = trendingSearchesData as string[];

export async function getTrendingSearches(): Promise<string[]> {
  return trendingSearches;
}
