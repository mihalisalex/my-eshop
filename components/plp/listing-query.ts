import type { PlpSort } from "@/components/plp/PlpSortSelect";
import type { SearchOptions } from "@/lib/commerce/types";

/**
 * One reading of a listing URL, shared by the server component that renders the first
 * page and the client component that takes over from it.
 *
 * It exists because those two now have to agree exactly. The grid used to be fetched only
 * in the browser, so the query string had a single interpreter; server-rendering it adds a
 * second, and any disagreement between them shows up as a hydration mismatch or — worse,
 * because it is silent — as a server-rendered page of products that the client immediately
 * throws away and refetches.
 */

export const PLP_PAGE_SIZE = 8;

export interface ListingQuery {
  /** A category refinement from the URL, distinct from the page's own base scope. */
  category: string | null;
  isNew: boolean;
  tags: string[];
  colors: string[];
  sizes: string[];
  availability: "all" | "in-stock";
  /** The shopper's gender REFINEMENT — only meaningful where the page isn't already one gender. */
  gender: string | null;
  sort: PlpSort;
  minPrice?: number;
  maxPrice?: number;
  /** 1-indexed. Infinite scroll accumulates pages 1..page. */
  page: number;
}

/**
 * What every listing route receives. Awaiting `searchParams` is what opts these routes into
 * dynamic rendering, which server-rendering the grid requires — see ProductListingSection.
 */
export interface ListingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Reads one query-string value, whichever shape the caller happens to hold it in. */
export type ParamReader = (key: string) => string | null;

/** Adapts a Server Component's `searchParams` object to a ParamReader. */
export function searchParamReader(params: Record<string, string | string[] | undefined>): ParamReader {
  return (key) => {
    const value = params[key];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };
}

function parseCsv(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

function parsePositiveNumber(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseListingQuery(get: ParamReader, defaultSort: PlpSort): ListingQuery {
  return {
    category: get("category"),
    isNew: get("isNew") === "true",
    tags: parseCsv(get("tag")),
    colors: parseCsv(get("color")),
    sizes: parseCsv(get("size")),
    availability: get("availability") === "in-stock" ? "in-stock" : "all",
    gender: get("gender"),
    sort: (get("sort") as PlpSort | null) ?? defaultSort,
    minPrice: parsePositiveNumber(get("minPrice")),
    maxPrice: parsePositiveNumber(get("maxPrice")),
    // A page count is a count, so anything unparseable or below 1 is page 1 rather than an
    // error — a hand-edited `?page=abc` should show the listing, not break it.
    page: Math.max(1, Number(get("page")) || 1),
  };
}

/**
 * The search options for one page of a listing, given the page's own scope and the
 * shopper's refinements.
 *
 * `showGenderFilter` decides whether the URL's `gender` is honoured at all: on /women the
 * page IS the gender, and a stray `?gender=men` must not contradict the heading.
 */
export function listingSearchOptions(
  baseFilters: Pick<SearchOptions, "gender" | "category" | "collectionId" | "isNew" | "isSale">,
  query: ListingQuery,
  page: number
): SearchOptions {
  const showGenderFilter = !baseFilters.gender;
  return {
    ...baseFilters,
    category: query.category ?? baseFilters.category,
    isNew: query.isNew || baseFilters.isNew,
    // A REFINEMENT, not scope — see SearchOptions.genders. Sent this way so the facet keeps
    // reporting every gender in the listing and "Όλα" stays reachable.
    genders: showGenderFilter && query.gender ? [query.gender] : undefined,
    colors: query.colors.length ? query.colors : undefined,
    sizes: query.sizes.length ? query.sizes : undefined,
    tags: query.tags.length ? query.tags : undefined,
    availability: query.availability,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    sort: query.sort,
    page,
    pageSize: PLP_PAGE_SIZE,
  };
}

/**
 * A stable signature for "which result set is this". Everything the search depends on
 * EXCEPT the page number, so paging accumulates into one cache entry while any real filter
 * change starts a fresh one.
 */
export function listingSignature(
  baseFilters: Pick<SearchOptions, "gender" | "category" | "collectionId" | "isNew" | "isSale">,
  query: ListingQuery
): string {
  const { page: _page, ...rest } = query;
  return JSON.stringify({ baseFilters, ...rest });
}
