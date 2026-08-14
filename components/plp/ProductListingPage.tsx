"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { getCommerceProvider } from "@/lib/commerce";
import { getEffectivePrice } from "@/lib/product";
import { ProductCard } from "@/components/product/ProductCard";
import { PlpToolbar } from "@/components/plp/PlpToolbar";
import { PlpFilterSidebar, type PlpFilters } from "@/components/plp/PlpFilterSidebar";
import type { PlpSort } from "@/components/plp/PlpSortSelect";
import type { SearchFacet, SearchOptions } from "@/lib/commerce/types";
import type { Product } from "@/types";

const PAGE_SIZE = 8;

interface ProductListingPageProps {
  title: string;
  description?: string;
  baseFilters: Pick<SearchOptions, "gender" | "category" | "collectionId" | "isNew" | "isSale">;
  /** Set false when the page already renders its own hero/title above this component (e.g. a collection hero banner). */
  showHeader?: boolean;
}

function parseCsv(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export function ProductListingPage({ title, description, baseFilters, showHeader = true }: ProductListingPageProps) {
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
  const sort = (searchParams.get("sort") as PlpSort | null) ?? "relevance";
  const minPriceParam = searchParams.get("minPrice");
  const maxPriceParam = searchParams.get("maxPrice");
  const urlPage = Math.max(1, Number(searchParams.get("page")) || 1);

  const [priceBounds, setPriceBounds] = useState<[number, number] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [facets, setFacets] = useState<SearchFacet[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const scopeFilters = { ...baseFilters, category: category ?? baseFilters.category, isNew: isNew || baseFilters.isNew };
  const baseFiltersKey = JSON.stringify(scopeFilters);

  useEffect(() => {
    let cancelled = false;
    commerce.search.search("", { ...scopeFilters, pageSize: 500 }).then((result) => {
      if (cancelled) return;
      const prices = result.products.map((p) => getEffectivePrice(p).amount);
      setPriceBounds(prices.length ? [Math.min(...prices), Math.max(...prices)] : [0, 0]);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- baseFiltersKey is the stable identity for the baseFilters object
  }, [baseFiltersKey, commerce]);

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

    const signature = JSON.stringify({ baseFiltersKey, colors, sizes, tags, availability, sort, minPriceFilter, maxPriceFilter });
    let entry = pageCacheRef.current.get(signature);
    if (!entry) {
      entry = { pages: new Map<number, Product[]>(), facets: [], total: 0 };
      pageCacheRef.current.set(signature, entry);
    }
    const cacheEntry = entry;

    (async () => {
      for (let page = 1; page <= urlPage; page += 1) {
        if (cacheEntry.pages.has(page)) continue;
        const result = await commerce.search.search("", {
          ...scopeFilters,
          colors: colors.length ? colors : undefined,
          sizes: sizes.length ? sizes : undefined,
          tags: tags.length ? tags : undefined,
          availability,
          minPrice: minPriceFilter,
          maxPrice: maxPriceFilter,
          sort,
          page,
          pageSize: PAGE_SIZE,
        });
        if (cancelled) return;
        cacheEntry.pages.set(page, result.products);
        cacheEntry.facets = result.facets;
        cacheEntry.total = result.total;
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
  }, [baseFiltersKey, colors.join(","), sizes.join(","), tags.join(","), availability, sort, minPriceFilter, maxPriceFilter, urlPage, commerce]);

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
      if (patch.priceRange && priceBounds) {
        next.minPrice = patch.priceRange[0] !== priceBounds[0] ? String(patch.priceRange[0]) : null;
        next.maxPrice = patch.priceRange[1] !== priceBounds[1] ? String(patch.priceRange[1]) : null;
      }
      updateParams(next);
    },
    [updateParams, priceBounds]
  );

  const handleSortChange = useCallback(
    (nextSort: PlpSort) => updateParams({ sort: nextSort === "relevance" ? null : nextSort, page: null }),
    [updateParams]
  );

  const handleClearAll = useCallback(
    () => updateParams({ color: null, size: null, availability: null, minPrice: null, maxPrice: null, page: null }),
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

  const filters: PlpFilters = { colors, sizes, availability, priceRange: displayPriceRange };

  return (
    <div className="container-luxe py-10 md:py-14">
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
            />
          ) : null}
        </aside>

        <div>
          <PlpToolbar
            total={total}
            sort={sort}
            onSortChange={handleSortChange}
            facets={facets}
            priceBounds={priceBounds ?? [0, 0]}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onClearAll={handleClearAll}
          />

          {isLoading && products.length === 0 ? (
            <p className="py-16 text-center text-sm text-luxe-gray-dark">Loading...</p>
          ) : total === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <PackageSearch className="size-10 text-luxe-gray-dark" strokeWidth={1} />
              <p className="text-sm text-luxe-gray-dark">No products match your filters.</p>
              <button type="button" onClick={handleClearAll} className="text-sm underline underline-offset-4">
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
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
  );
}
