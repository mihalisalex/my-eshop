"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PlpSortSelect, type PlpSort } from "@/components/plp/PlpSortSelect";
import { PlpFilterSidebar, type PlpFilters } from "@/components/plp/PlpFilterSidebar";
import type { SearchFacet } from "@/lib/commerce/types";

interface PlpToolbarProps {
  total: number;
  /** Suppresses the count while the first result set is still in flight — see below. */
  isLoading?: boolean;
  sort: PlpSort;
  onSortChange: (sort: PlpSort) => void;
  facets: SearchFacet[];
  priceBounds: [number, number];
  filters: PlpFilters;
  onFiltersChange: (patch: Partial<PlpFilters>) => void;
  onClearAll: () => void;
  /** Threaded to the sheet's sidebar; see PlpFilterSidebar for why a gendered listing hides it. */
  showGender?: boolean;
}

export function PlpToolbar({
  showGender = false,
  total,
  isLoading = false,
  sort,
  onSortChange,
  facets,
  priceBounds,
  filters,
  onFiltersChange,
  onClearAll,
}: PlpToolbarProps) {
  const t = useTranslations("Plp");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // `min-w-0` on the row and both children is what removes the 320px horizontal overflow.
  // A <select> is intrinsically as wide as its longest option ("Price: Low to High"), and a
  // flex item never shrinks below its intrinsic minimum unless min-width is cleared — so at
  // 320px this row measured 326px and pushed the whole page sideways. With min-width released
  // the select shrinks and clips its own label instead, and the count truncates rather than
  // forcing the row wider.
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border pb-4 sm:gap-4">
      {/* Nothing rather than "0 items" while the first fetch is in flight. The count
          rendered as 0 during loading and then jumped to the real figure, so on a slow
          connection a shopper saw an apparently empty category before it filled in. */}
      <p className="min-w-0 truncate text-sm text-luxe-gray-dark">
        {isLoading ? " " : t(total === 1 ? "itemsOne" : "itemsOther", { count: total })}
      </p>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="flex h-10 shrink-0 items-center gap-2 border border-border px-2.5 text-sm sm:px-3 lg:hidden"
        >
          <SlidersHorizontal className="size-4" strokeWidth={1.5} />
          {t("filter")}
        </button>
        <PlpSortSelect value={sort} onChange={onSortChange} className="min-w-0" />
      </div>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-full border-none bg-luxe-white p-0 sm:max-w-sm">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
            <SheetTitle className="font-heading text-lg tracking-[0.1em] uppercase">{t("filter")}</SheetTitle>
            <SheetClose aria-label={t("closeFilters")}>
              <X className="size-5" strokeWidth={1.5} />
            </SheetClose>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <PlpFilterSidebar
              facets={facets}
              priceBounds={priceBounds}
              filters={filters}
              onChange={onFiltersChange}
              onClearAll={onClearAll}
              showTitle={false}
              showGender={showGender}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
