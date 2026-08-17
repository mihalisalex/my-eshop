"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Clock3, Search, TrendingUp, X } from "lucide-react";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { useDebounce } from "@/hooks/use-debounce";
import { useRecentSearches } from "@/hooks/use-recent-searches";
import { EASE } from "@/constants/animation";
import { getCommerceProvider } from "@/lib/commerce";
import { getTrendingSearches } from "@/services/search";
import { SearchProductResult } from "@/components/layout/search/SearchProductResult";
import { SearchCollectionResult } from "@/components/layout/search/SearchCollectionResult";
import { cn } from "@/lib/utils";
import type { Collection, Product } from "@/types";

interface SearchOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SearchEntry =
  | { type: "term"; term: string; source: "recent" | "trending" }
  | { type: "product"; product: Product }
  | { type: "collection"; collection: Collection };

const MIN_QUERY_LENGTH = 2;

/**
 * The query is echoed back verbatim in the no-results message, so a very long one (a
 * pasted paragraph, or an accidental key-repeat) filled the panel with the shopper own
 * text instead of a readable message. React escapes it, so this is legibility rather
 * than safety.
 */
function truncateForDisplay(query: string): string {
  return query.length > 60 ? query.slice(0, 60) + "…" : query;
}

export function SearchOverlay({ open, onOpenChange }: SearchOverlayProps) {
  const t = useTranslations("Search");
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const router = useRouter();
  const commerce = useMemo(() => getCommerceProvider(), []);
  const { terms: recent, addTerm, clear: clearRecent } = useRecentSearches();

  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState<string[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQuery = useDebounce(query, 250);
  const trimmedQuery = query.trim();
  const isQueryLongEnough = debouncedQuery.trim().length >= MIN_QUERY_LENGTH;

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    getTrendingSearches().then(setTrending);
    commerce.collections.getAll().then(setAllCollections);
  }, [open, commerce]);

  useEffect(() => {
    const normalized = debouncedQuery.trim();
    if (normalized.length < MIN_QUERY_LENGTH) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale results when the query drops below the search threshold
      setProducts([]);
      setCollections([]);
      setIsSearching(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsSearching(true);
    commerce.search.search(normalized, { limit: 6 }).then((result) => {
      if (requestId !== requestIdRef.current) return;
      const matchingCollections = allCollections
        .filter((c) => c.title.toLowerCase().includes(normalized.toLowerCase()))
        .slice(0, 4);
      setProducts(result.products);
      setCollections(matchingCollections);
      setIsSearching(false);
    });
  }, [debouncedQuery, commerce, allCollections]);

  const entries: SearchEntry[] = useMemo(() => {
    if (!isQueryLongEnough) {
      const recentEntries: SearchEntry[] = recent.map((term) => ({ type: "term", term, source: "recent" }));
      const trendingEntries: SearchEntry[] = trending.map((term) => ({ type: "term", term, source: "trending" }));
      return [...recentEntries, ...trendingEntries];
    }
    return [
      ...products.map((product): SearchEntry => ({ type: "product", product })),
      ...collections.map((collection): SearchEntry => ({ type: "collection", collection })),
    ];
  }, [isQueryLongEnough, recent, trending, products, collections]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset selection when the visible entry list changes
    setActiveIndex(-1);
  }, [entries.length, debouncedQuery]);

  const close = () => onOpenChange(false);

  const goToEntry = (entry: SearchEntry) => {
    if (entry.type === "term") {
      setQuery(entry.term);
      return;
    }
    if (trimmedQuery.length >= MIN_QUERY_LENGTH) addTerm(trimmedQuery);
    close();
    router.push(entry.type === "product" ? `/products/${entry.product.slug}` : `/collections/${entry.collection.slug}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (entries.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % entries.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + entries.length) % entries.length);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      goToEntry(entries[activeIndex]);
    } else if (event.key === "Enter" && trimmedQuery.length >= MIN_QUERY_LENGTH) {
      addTerm(trimmedQuery);
    }
  };

  const showTermSections = !isQueryLongEnough;
  const showNoResults = isQueryLongEnough && !isSearching && products.length === 0 && collections.length === 0;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="fixed inset-0 z-100 overflow-y-auto bg-luxe-white"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
        >
          <div className="container-luxe flex h-16 items-center justify-between border-b border-border">
            <span className="font-heading text-lg tracking-[0.1em] uppercase">{t("title")}</span>
            <button type="button" aria-label={t("closeSearch")} onClick={close}>
              <X className="size-5" strokeWidth={1.5} />
            </button>
          </div>
          <div className="container-luxe pb-16">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
              className="flex items-center gap-4 border-b border-border py-8"
            >
              <Search className="size-6 text-luxe-gray-dark" strokeWidth={1.5} />
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-expanded={entries.length > 0}
                aria-controls="search-results-list"
                aria-autocomplete="list"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("placeholder")}
                className="font-heading w-full bg-transparent text-2xl outline-none placeholder:text-luxe-gray-dark md:text-4xl"
              />
            </motion.div>

            <div id="search-results-list" role="listbox" className="py-6">
              {showTermSections ? (
                <div className="space-y-8">
                  {recent.length > 0 ? (
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-eyebrow flex items-center gap-1.5">
                          <Clock3 className="size-3.5" strokeWidth={1.5} />
                          {t("recentSearches")}
                        </p>
                        <button
                          type="button"
                          onClick={clearRecent}
                          className="text-xs text-luxe-gray-dark underline underline-offset-4 hover:text-luxe-black"
                        >
                          {t("clear")}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recent.map((term) => {
                          const index = entries.findIndex((e) => e.type === "term" && e.source === "recent" && e.term === term);
                          return (
                            <button
                              key={term}
                              type="button"
                              data-active={index === activeIndex}
                              onClick={() => goToEntry({ type: "term", term, source: "recent" })}
                              className={cn(
                                "border border-border px-3 py-1.5 text-sm transition-colors hover:border-luxe-black",
                                index === activeIndex && "border-luxe-black bg-luxe-gray-light"
                              )}
                            >
                              {term}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <p className="text-eyebrow mb-3 flex items-center gap-1.5">
                      <TrendingUp className="size-3.5" strokeWidth={1.5} />
                      {t("trendingSearches")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {trending.map((term) => {
                        const index = entries.findIndex((e) => e.type === "term" && e.source === "trending" && e.term === term);
                        return (
                          <button
                            key={term}
                            type="button"
                            data-active={index === activeIndex}
                            onClick={() => goToEntry({ type: "term", term, source: "trending" })}
                            className={cn(
                              "border border-border px-3 py-1.5 text-sm transition-colors hover:border-luxe-black",
                              index === activeIndex && "border-luxe-black bg-luxe-gray-light"
                            )}
                          >
                            {term}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : isSearching ? (
                <p className="py-8 text-sm text-luxe-gray-dark">{t("searching")}</p>
              ) : showNoResults ? (
                <p className="py-8 text-sm text-luxe-gray-dark">{t("noResults", { query: truncateForDisplay(debouncedQuery.trim()) })}</p>
              ) : (
                <div className="space-y-6">
                  {products.length > 0 ? (
                    <div>
                      <p className="text-eyebrow mb-2">{t("products")}</p>
                      <div className="-mx-2">
                        {products.map((product) => {
                          const index = entries.findIndex((e) => e.type === "product" && e.product.id === product.id);
                          return (
                            <SearchProductResult
                              key={product.id}
                              product={product}
                              active={index === activeIndex}
                              onNavigate={() => goToEntry({ type: "product", product })}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {collections.length > 0 ? (
                    <div>
                      <p className="text-eyebrow mb-2">{t("collections")}</p>
                      <div className="-mx-2">
                        {collections.map((collection) => {
                          const index = entries.findIndex((e) => e.type === "collection" && e.collection.id === collection.id);
                          return (
                            <SearchCollectionResult
                              key={collection.id}
                              collection={collection}
                              active={index === activeIndex}
                              onNavigate={() => goToEntry({ type: "collection", collection })}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
