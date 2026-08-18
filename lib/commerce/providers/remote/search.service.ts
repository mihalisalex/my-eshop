import type { SearchOptions, SearchResult, SearchService } from "@/lib/commerce/types";

/**
 * Browser-side SearchService: one request to `/api/search` per result set.
 *
 * The previous implementation ran the whole search in the browser — it pulled every
 * product in scope from `/api/products` (200 KB for /women, 323 KB unfiltered) and then
 * filtered, sorted, faceted and paginated that array in JavaScript, plus a second
 * 500-product request purely to find the price-slider bounds. Paging was therefore free
 * but pointless: the catalog had already been downloaded before the first card rendered,
 * and again whenever a filter changed.
 *
 * The response now carries the page, the facet counts and the price bounds together, so
 * a listing page makes one request and receives only what it draws.
 */
export interface RemoteSearchResult extends SearchResult {
  priceBounds: [number, number];
}

function toQuery(query: string, options: SearchOptions): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (options.category) params.set("category", options.category);
  if (options.gender) params.set("gender", options.gender);
  if (options.collectionId) params.set("collectionId", options.collectionId);
  if (options.colors?.length) params.set("colors", options.colors.join(","));
  if (options.sizes?.length) params.set("sizes", options.sizes.join(","));
  if (options.tags?.length) params.set("tags", options.tags.join(","));
  if (options.availability === "in-stock") params.set("availability", "in-stock");
  if (options.isNew) params.set("isNew", "true");
  if (options.isSale) params.set("isSale", "true");
  if (typeof options.minPrice === "number") params.set("minPrice", String(options.minPrice));
  if (typeof options.maxPrice === "number") params.set("maxPrice", String(options.maxPrice));
  if (options.sort) params.set("sort", options.sort);
  if (options.page) params.set("page", String(options.page));
  // `limit` is the search overlay's "just give me a few" knob; the listing pages send
  // pageSize. They mean the same thing to the endpoint.
  const size = options.pageSize ?? options.limit;
  if (size) params.set("pageSize", String(size));
  return params.toString();
}

export function createRemoteSearchService(): SearchService {
  return {
    async search(query: string, options: SearchOptions = {}): Promise<RemoteSearchResult> {
      const response = await fetch(`/api/search?${toQuery(query, options)}`);
      if (!response.ok) throw new Error(`Search failed (${response.status})`);
      return (await response.json()) as RemoteSearchResult;
    },

    async getSuggestions(query: string, limit = 5): Promise<string[]> {
      if (!query.trim()) return [];
      const params = new URLSearchParams({ q: query.trim(), suggestions: "true", limit: String(limit) });
      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) throw new Error(`Suggestions failed (${response.status})`);
      return ((await response.json()) as { suggestions: string[] }).suggestions;
    },
  };
}
