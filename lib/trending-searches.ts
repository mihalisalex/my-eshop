import trendingSearchesData from "@/data/trending-searches.json";

/**
 * The suggested searches shown in the header overlay before anyone types.
 *
 * Lives here rather than in `services/search.ts` because that module is `server-only`
 * (it runs raw SQL through Prisma) while `SearchOverlay` is a client component. A client
 * importing from a server-only module is a build error, and the shared filename was the
 * only thing connecting two things with nothing else in common.
 */
const trendingSearches = trendingSearchesData as string[];

export function getTrendingSearches(): string[] {
  return trendingSearches;
}
