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
import type { SearchFacet, SearchOptions, SearchResult } from "@/lib/commerce/types";
import type { Product } from "@/types";

const PAGE_SIZE = 8;

interface ProductListingPageProps {
  title: string;
  description?: string;
  baseFilters: Pick<SearchOptions, "gender" | "category" | "collectionId" | "isNew" | "isSale">;
  /** Set false when the page already renders its own hero/title above this component (e.g. a collection hero banner). */
  showHeader?: boolean;
  /** Sort applied when the shopper has not chosen one. /new-in uses "newest" so the page means something. */
  defaultSort?: PlpSort;
}

function parseCsv(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export function ProductListingPage({ title, description, baseFilters, showHeader = true, defaultSort = "relevance" }: ProductListingPageProps) {
  const t = useTranslations("Plp");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const commerce = useMemo(() => getCommerceProvider(), []);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const category = searchParams.get("category");
  const isNew = searchParams.get("isNew") === "true";
  const tags = parseCsv(searchParams.get("tag"));
  const colors = parseCsv(searchParams.get("color"));
  const sizes = parseCsv(searchParams.get("size"));
  const availability = searchParams.get("availability") === "in-stock" ? "in-stock" : "all";
  // Only meaningful where the page has not already pinned a gender. On /women the scope's
  // own gender wins below, so a stray ?gender=men in the URL cannot contradict the heading.
  const genderParam = searchParams.get("gender");
  const sort = (searchParams.get("sort") as PlpSort | null) ?? defaultSort;
  const minPriceParam = searchParams.get("minPrice");
  const maxPriceParam = searchParams.get("maxPrice");
  const urlPage = Math.max(1, Number(searchParams.get("page")) || 1);

  const [priceBounds, setPriceBounds] = useState<[number, number] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [facets, setFacets] = useState<SearchFacet[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Offered only where the listing is not already one gender. On /women the page IS the
  // gender, so the control would be a no-op that contradicts its own heading.
  const showGenderFilter = !baseFilters.gender;
  const scopeFilters = { ...baseFilters, category: category ?? baseFilters.category, isNew: isNew || baseFilters.isNew };
  const baseFiltersKey = JSON.stringify(scopeFilters);

  // The price-slider bounds used to come from a SECOND request for 500 products, issued
  // on every listing view purely to read a minimum and a maximum. /api/search now returns
  // them alongside the page it was already sending, so the bounds cost nothing.

  // Used for the slider UI, which needs the full bounds to draw its track/handles.
  const displayPriceRange: [number, number] = [
    minPriceParam ? Number(minPriceParam) : (priceBounds?.[0] ?? 0),
    maxPriceParam ? Number(maxPriceParam) : (priceBounds?.[1] ?? 0),
  ];

  // Sent to the search API only when the user actually narrowed the range. Omitting it
  // otherwise is equivalent to filtering by the full bounds anyway (a no-op), and lets the
  // results fetch below run immediately instead of waiting on the bounds fetch to resolve —
  // that wait used to serialize two full round-trips before any product appeared.
  const minPriceFilter = minPriceParam ? Number(minPriceParam) : undefined;
  const maxPriceFilter = maxPriceParam ? Number(maxPriceParam) : undefined;

  // Keyed by every filter/sort dimension below (everything except urlPage/commerce) — a
  // signature change means a genuinely different result set, so it gets a fresh cache
  // entry; the same signature reuses whatever pages were already fetched. Deliberately
  // independent of the price-bounds fetch above (see minPriceFilter/maxPriceFilter) so
  // this effect can run immediately instead of waiting on that one to resolve.
  // This is what turns "Load More" from a full 1..urlPage refetch into a single new
  // request per click, without changing any of the state this component exposes.
  const pageCacheRef = useRef(new Map<string, { pages: Map<number, Product[]>; facets: SearchFacet[]; total: number }>());

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- must flip to loading before kicking off the async fetch pipeline below
    setIsLoading(true);

    const signature = JSON.stringify({ baseFiltersKey, genderParam, colors, sizes, tags, availability, sort, minPriceFilter, maxPriceFilter });
    let entry = pageCacheRef.current.get(signature);
    if (!entry) {
      entry = { pages: new Map<number, Product[]>(), facets: [], total: 0 };
      pageCacheRef.current.set(signature, entry);
    }
    const cacheEntry = entry;

    (async () => {
      for (let page = 1; page <= urlPage; page += 1) {
        if (cacheEntry.pages.has(page)) continue;
        const result = (await commerce.search.search("", {
          ...scopeFilters,
          // A REFINEMENT, not scope — see SearchOptions.genders. Sent this way so the facet
          // keeps reporting every gender in the listing and "Όλα" stays reachable.
          genders: showGenderFilter && genderParam ? [genderParam] : undefined,
          colors: colors.length ? colors : undefined,
          sizes: sizes.length ? sizes : undefined,
          tags: tags.length ? tags : undefined,
          availability,
          minPrice: minPriceFilter,
          maxPrice: maxPriceFilter,
          sort,
          page,
          pageSize: PAGE_SIZE,
        })) as SearchResult & { priceBounds?: [number, number] };
        if (cancelled) return;
        cacheEntry.pages.set(page, result.products);
        cacheEntry.facets = result.facets;
        cacheEntry.total = result.total;
        if (result.priceBounds) setPriceBounds(result.priceBounds);
      }

      if (cancelled) return;
      const collected: Product[] = [];
      for (let page = 1; page <= urlPage; page += 1) collected.push(...(cacheEntry.pages.get(page) ?? []));
      setProducts(collected);
      setFacets(cacheEntry.facets);
      setTotal(cacheEntry.total);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- colors/sizes are re-derived from searchParams each render; joining keeps the effect keyed on their content
  }, [baseFiltersKey, genderParam, colors.join(","), sizes.join(","), tags.join(","), availability, sort, minPriceFilter, maxPriceFilter, urlPage, commerce]);

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
