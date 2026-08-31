"use client";
import { useTranslations } from "next-intl";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { getCommerceProvider } from "@/lib/commerce";
import { ProductCard } from "@/components/product/ProductCard";
import { PlpToolbar } from "@/components/plp/PlpToolbar";
import { PlpFilterSidebar, type PlpFilters } from "@/components/plp/PlpFilterSidebar";
import type { PlpSort } from "@/components/plp/PlpSortSelect";
import type { SearchFacet, SearchOptions } from "@/lib/commerce/types";
import type { Product } from "@/types";
import {
  PLP_PAGE_SIZE,
  listingSearchOptions,
  listingSignature,
  parseListingQuery,
} from "@/components/plp/listing-query";

/**
 * What the server already fetched and rendered for this exact URL.
 *
 * Passed down by ProductListingSection so the grid arrives in the HTML rather than
 * appearing a round-trip after hydration. Absent only if a caller renders this component
 * without its server wrapper, which still works — it just starts empty and fetches.
 */
export interface InitialListing {
  products: Product[];
  facets: SearchFacet[];
  total: number;
  priceBounds: [number, number] | null;
  /** The signature the server rendered. Seeded state is used only if the URL still matches. */
  signature: string;
  /** How many pages the server accumulated, so infinite scroll resumes rather than restarts. */
  pages: number;
}

interface ProductListingPageProps {
  title: string;
  description?: string;
  baseFilters: Pick<SearchOptions, "gender" | "category" | "collectionId" | "isNew" | "isSale">;
  /** Set false when the page already renders its own hero/title above this component (e.g. a collection hero banner). */
  showHeader?: boolean;
  /** Sort applied when the shopper has not chosen one. /new-in uses "newest" so the page means something. */
  defaultSort?: PlpSort;
  initialListing?: InitialListing;
}

export function ProductListingPage({
  title,
  description,
  baseFilters,
  showHeader = true,
  defaultSort = "relevance",
  initialListing,
}: ProductListingPageProps) {
  const t = useTranslations("Plp");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const commerce = useMemo(() => getCommerceProvider(), []);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Parsed by the same function the server used, so the two cannot drift apart.
  const query = parseListingQuery((key) => searchParams.get(key), defaultSort);
  // `tags` is deliberately not destructured: it is a scope filter carried straight through
  // to the search by listingSearchOptions, and this component renders no control for it.
  const { colors, sizes, availability, sort, page: urlPage } = query;
  const genderParam = query.gender;
  const signature = listingSignature(baseFilters, query);

  /**
   * The server's work is reused only when the URL still describes the same result set.
   *
   * It usually does — this is the first render after a full page load. It does not after a
   * client-side filter change, where `router.replace` updates the query string without
   * re-running the server component, and the seeded page would then be the previous
   * filter's products.
   */
  const seeded = initialListing && initialListing.signature === signature ? initialListing : null;

  const [priceBounds, setPriceBounds] = useState<[number, number] | null>(seeded?.priceBounds ?? null);
  const [products, setProducts] = useState<Product[]>(seeded?.products ?? []);
  const [facets, setFacets] = useState<SearchFacet[]>(seeded?.facets ?? []);
  const [total, setTotal] = useState(seeded?.total ?? 0);
  const [isLoading, setIsLoading] = useState(!seeded);

  // Offered only where the listing is not already one gender. On /women the page IS the
  // gender, so the control would be a no-op that contradicts its own heading.
  const showGenderFilter = !baseFilters.gender;
  const minPriceParam = query.minPrice !== undefined ? String(query.minPrice) : null;
  const maxPriceParam = query.maxPrice !== undefined ? String(query.maxPrice) : null;

  // The price-slider bounds used to come from a SECOND request for 500 products, issued
  // on every listing view purely to read a minimum and a maximum. /api/search now returns
  // them alongside the page it was already sending, so the bounds cost nothing.

  // Used for the slider UI, which needs the full bounds to draw its track/handles.
  const displayPriceRange: [number, number] = [
    minPriceParam ? Number(minPriceParam) : (priceBounds?.[0] ?? 0),
    maxPriceParam ? Number(maxPriceParam) : (priceBounds?.[1] ?? 0),
  ];

  /**
   * Keyed by every filter/sort dimension except the page number — a signature change means
   * a genuinely different result set, so it gets a fresh cache entry; the same signature
   * reuses whatever pages were already fetched. This is what turns "Load More" from a full
   * 1..urlPage refetch into a single new request per click.
   *
   * Seeded from the server's render, which is the point of the whole exercise: without
   * this, the browser would immediately refetch the very products it was just handed in
   * the HTML, and the round trip the server render exists to remove would still happen.
   */
  // A lazy `useState` initialiser rather than a `useRef`, because the seeding below has to
  // happen exactly once and before the first effect runs — and reading or writing a ref
  // during render is precisely what React forbids.
  const [pageCache] = useState(() => {
    const cache = new Map<string, { pages: Map<number, Product[]>; facets: SearchFacet[]; total: number }>();
    if (seeded) {
      const pages = new Map<number, Product[]>();
      // The server accumulated pages 1..N into one array, exactly as this component does
      // for infinite scroll, so it is re-split along the page size it was fetched with.
      for (let page = 1; page <= seeded.pages; page += 1) {
        pages.set(page, seeded.products.slice((page - 1) * PLP_PAGE_SIZE, page * PLP_PAGE_SIZE));
      }
      cache.set(seeded.signature, { pages, facets: seeded.facets, total: seeded.total });
    }
    return cache;
  });

  useEffect(() => {
    let cancelled = false;

    let entry = pageCache.get(signature);
    if (!entry) {
      entry = { pages: new Map<number, Product[]>(), facets: [], total: 0 };
      pageCache.set(signature, entry);
    }
    const cacheEntry = entry;

    const applyFromCache = () => {
      const collected: Product[] = [];
      for (let page = 1; page <= urlPage; page += 1) collected.push(...(cacheEntry.pages.get(page) ?? []));
      setProducts(collected);
      setFacets(cacheEntry.facets);
      setTotal(cacheEntry.total);
      setIsLoading(false);
    };

    let missing = false;
    for (let page = 1; page <= urlPage; page += 1) {
      if (!cacheEntry.pages.has(page)) missing = true;
    }

    if (!missing) {
      // Every page asked for is already held — going back to a filter that was visited
      // before, so show it without a request.
      //
      // Except on the very first render, where what is already on screen IS this cache
      // entry: it came from the server. Re-applying it would replace the grid with an
      // identical copy of itself and cost a render for nothing.
      const alreadyOnScreen = seeded?.signature === signature && seeded?.pages === urlPage;
      if (!alreadyOnScreen) applyFromCache();
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- must flip to loading before kicking off the async fetch pipeline below
    setIsLoading(true);

    (async () => {
      for (let page = 1; page <= urlPage; page += 1) {
        if (cacheEntry.pages.has(page)) continue;
        const result = await commerce.search.search("", listingSearchOptions(baseFilters, query, page));
        if (cancelled) return;
        const withBounds = result as typeof result & { priceBounds?: [number, number] };
        cacheEntry.pages.set(page, result.products);
        cacheEntry.facets = result.facets;
        cacheEntry.total = result.total;
        if (withBounds.priceBounds) setPriceBounds(withBounds.priceBounds);
      }

      if (cancelled) return;
      applyFromCache();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` already encodes every filter dimension `query` carries; listing them again would re-run this effect on each render for no change
  }, [signature, urlPage, commerce]);

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const handleFiltersChange = useCallback(
    (patch: Partial<PlpFilters>) => {
      const next: Record<string, string | null> = { page: null };
      if (patch.colors) next.color = patch.colors.length ? patch.colors.join(",") : null;
      if (patch.sizes) next.size = patch.sizes.length ? patch.sizes.join(",") : null;
      if (patch.availability) next.availability = patch.availability === "in-stock" ? "in-stock" : null;
      // Present-but-null is a real instruction here ("all"), which is why this checks the key
      // rather than the value — `if (patch.gender)` would silently ignore clearing it.
      if ("gender" in patch) next.gender = patch.gender ?? null;
      if (patch.priceRange && priceBounds) {
        next.minPrice = patch.priceRange[0] !== priceBounds[0] ? String(patch.priceRange[0]) : null;
        next.maxPrice = patch.priceRange[1] !== priceBounds[1] ? String(patch.priceRange[1]) : null;
      }
      updateParams(next);
    },
    [updateParams, priceBounds]
  );

  const handleSortChange = useCallback(
    // Selecting the page’s own default clears the param rather than pinning it, so the
    // canonical URL stays clean.
    (nextSort: PlpSort) => updateParams({ sort: nextSort === defaultSort ? null : nextSort, page: null }),
    [updateParams, defaultSort]
  );

  const handleClearAll = useCallback(
    () => updateParams({ color: null, size: null, availability: null, minPrice: null, maxPrice: null, gender: null, page: null }),
    [updateParams]
  );

  const canLoadMore = products.length < total;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !canLoadMore) return;
    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries[0]?.isIntersecting && !isLoading) {
          updateParams({ page: String(urlPage + 1) });
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, isLoading, urlPage, updateParams]);

  const filters: PlpFilters = {
    colors,
    sizes,
    availability,
    priceRange: displayPriceRange,
    gender: showGenderFilter ? genderParam : null,
  };

  return (
    <div className="container-luxe py-10 md:py-14">
      {/* Narrows the page inset to 12px on phones so product images can be meaningfully
          larger while still sitting two to a row. Applied to the whole content block rather
          than the grid alone, so the heading and the filter/sort toolbar stay flush with the
          cards — a grid wider than the controls above it reads as a mistake.
          Done as a negative margin rather than a `px-3` override because `container-luxe` is
          declared in `@layer utilities` (app/globals.css), so its `px-6` would win against a
          competing padding utility regardless of class order. Cannot overflow: it gives back
          12px of the 24px the container reserves each side. Reset from `sm` upwards. */}
      <div className="-mx-3 sm:mx-0">
        {showHeader ? (
          <div className="mb-8">
            <h1 className="font-heading text-3xl md:text-4xl">{title}</h1>
            {description ? <p className="mt-2 text-luxe-gray-dark">{description}</p> : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[240px_1fr]">
          <aside className="hidden lg:block">
            {priceBounds ? (
              <PlpFilterSidebar
                facets={facets}
                priceBounds={priceBounds}
                filters={filters}
                onChange={handleFiltersChange}
                onClearAll={handleClearAll}
                showGender={showGenderFilter}
              />
            ) : null}
          </aside>

          <div>
            <PlpToolbar
              total={total}
              isLoading={isLoading && products.length === 0}
              sort={sort}
              onSortChange={handleSortChange}
              facets={facets}
              priceBounds={priceBounds ?? [0, 0]}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onClearAll={handleClearAll}
              showGender={showGenderFilter}
            />

            {isLoading && products.length === 0 ? (
              <p className="py-16 text-center text-sm text-luxe-gray-dark">Loading...</p>
            ) : total === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <PackageSearch className="size-10 text-luxe-gray-dark" strokeWidth={1} />
                <p className="text-sm text-luxe-gray-dark">{t("noMatches")}</p>
                <button type="button" onClick={handleClearAll} className="text-sm underline underline-offset-4">
                  {t("clearFilters")}
                </button>
              </div>
            ) : (
              <>
                {/* Column gap halves on mobile (16px -> 8px) so the two cards get the space
                    instead; the other half of the gain comes from the page-level inset below.
                    Unchanged from `sm` up, where there is already room. */}
                <div className="mt-6 grid grid-cols-2 gap-x-2 gap-y-8 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-10 lg:grid-cols-4">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                <div ref={sentinelRef} className="h-1" />

                {canLoadMore ? (
                  <div className="mt-10 flex justify-center">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => updateParams({ page: String(urlPage + 1) })}
                      className="h-12 border border-luxe-black px-8 text-xs font-medium tracking-[0.08em] uppercase transition-opacity hover:opacity-70 disabled:opacity-50"
                    >
                      {isLoading ? "Loading..." : "Load More"}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
