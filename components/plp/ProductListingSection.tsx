import { ProductListingPage, type InitialListing } from "@/components/plp/ProductListingPage";
import {
  PLP_PAGE_SIZE,
  listingSearchOptions,
  listingSignature,
  parseListingQuery,
  searchParamReader,
} from "@/components/plp/listing-query";
import type { PlpSort } from "@/components/plp/PlpSortSelect";
import type { SearchFacet, SearchOptions } from "@/lib/commerce/types";
import type { Product } from "@/types";
import { searchProducts } from "@/services/search";
import { getSeoDefaults } from "@/services/seo";
import { productListSchema } from "@/lib/seo";
import { JsonLd } from "@/components/shared/JsonLd";

/**
 * The server half of a product listing, and the reason category pages now have products in
 * their HTML.
 *
 * Every listing page — /women, /men, /new-in, /sale, /category/[slug], /collections/[slug] —
 * used to render a heading, a filter rail and an empty grid. The products arrived only
 * after hydration, from a fetch the client component issued in an effect. A crawler
 * therefore saw a page about nothing: no product names, no prices, and none of the
 * category-to-product links that are this shop's entire internal linking structure.
 *
 * This component runs the same query on the server, in-process against Postgres rather than
 * over HTTP, and hands the result to the client component as its initial state. The client
 * still owns filtering, sorting and infinite scroll; it simply starts from what is already
 * on screen instead of from nothing.
 *
 * Reading `searchParams` makes these routes render dynamically, which is deliberate and
 * worth stating: a listing that is server-rendered from a static build would freeze prices
 * and stock at build time, and this catalogue's whole point is that those move. Rendering
 * per request keeps them true — the same guarantee the client fetch used to provide.
 */
interface ProductListingSectionProps {
  title: string;
  description?: string;
  baseFilters: Pick<SearchOptions, "gender" | "category" | "collectionId" | "isNew" | "isSale">;
  /** Set false when the page already renders its own hero/title above this section. */
  showHeader?: boolean;
  /** Sort applied when the shopper has not chosen one. /new-in uses "newest" so the page means something. */
  defaultSort?: PlpSort;
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * How many pages deep a server render will go.
 *
 * Infinite scroll accumulates pages 1..N in the URL, so a shopper who scrolled and then
 * shared the link asks for all of them. Honouring that without limit would let `?page=500`
 * become a 4,000-row query on a public endpoint, so it is capped — beyond the cap the first
 * pages render server-side and the client fills in the rest exactly as it always has.
 */
const MAX_SERVER_RENDERED_PAGES = 5;

export async function ProductListingSection({
  title,
  description,
  baseFilters,
  showHeader = true,
  defaultSort = "relevance",
  searchParams,
}: ProductListingSectionProps) {
  const query = parseListingQuery(searchParamReader(searchParams), defaultSort);
  const pages = Math.min(query.page, MAX_SERVER_RENDERED_PAGES);
  const seo = await getSeoDefaults();

  /**
   * Fetched page by page rather than as one big query, so the shape matches exactly what
   * the client would have built for the same URL — same page size, same ordering, same
   * boundaries. A single `pageSize: pages * PLP_PAGE_SIZE` query would return the same
   * products but leave the client unable to reuse them per page.
   *
   * Sequential rather than parallel: these hit the same tables with the same filters, and a
   * listing is at most five of them.
   */
  const collected: Product[] = [];
  let facets: SearchFacet[] = [];
  let total = 0;
  let priceBounds: [number, number] | null = null;
  let fetchedPages = 0;

  for (let page = 1; page <= pages; page += 1) {
    const result = await searchProducts("", listingSearchOptions(baseFilters, query, page));
    collected.push(...result.products);
    facets = result.facets;
    total = result.total;
    priceBounds = result.priceBounds;
    fetchedPages = page;
    // A short page is the last one; asking for the ones after it would return nothing.
    if (result.products.length < PLP_PAGE_SIZE) break;
  }

  const initialListing: InitialListing = {
    products: collected,
    facets,
    total,
    priceBounds,
    signature: listingSignature(baseFilters, query),
    // What was actually fetched, not what was asked for. The client re-splits `products`
    // along this count, so overstating it would hand it empty pages it thinks are real.
    pages: fetchedPages,
  };

  return (
    <>
      {/*
        ItemList describing the products actually rendered below, emitted here because this
        is the one component that has both the list and the page it belongs to — so every
        listing route gets it from one place rather than six.

        Only page one. The markup describes what this URL shows; a shopper who scrolled to
        page 3 is looking at a URL that canonicalises to page one anyway, and re-describing
        the accumulated set would claim a different list than the canonical page holds.

        Skipped entirely when the page is empty — an ItemList of nothing is noise, and a
        filtered view with no matches is not a list worth declaring.
      */}
      {collected.length > 0 ? (
        <JsonLd
          data={productListSchema(
            collected.slice(0, PLP_PAGE_SIZE).map((product) => ({ slug: product.slug, name: product.name })),
            seo.siteUrl,
            title
          )}
        />
      ) : null}
      <ProductListingPage
        title={title}
        description={description}
        baseFilters={baseFilters}
        showHeader={showHeader}
        defaultSort={defaultSort}
        initialListing={initialListing}
      />
    </>
  );
}
