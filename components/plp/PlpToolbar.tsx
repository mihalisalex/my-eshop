"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PlpSortSelect, type PlpSort } from "@/components/plp/PlpSortSelect";
import { PlpFilterSidebar, type PlpFilters } from "@/components/plp/PlpFilterSidebar";
import type { SearchFacet } from "@/lib/commerce/types";

interface PlpToolbarProps {
  total: number;
  sort: PlpSort;
  onSortChange: (sort: PlpSort) => void;
  facets: SearchFacet[];
  priceBounds: [number, number];
  filters: PlpFilters;
  onFiltersChange: (patch: Partial<PlpFilters>) => void;
  onClearAll: () => void;
}

export function PlpToolbar({
  total,
  sort,
  onSortChange,
  facets,
  priceBounds,
  filters,
  onFiltersChange,
  onClearAll,
}: PlpToolbarProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
      <p className="text-sm text-luxe-gray-dark">
        {total} {total === 1 ? "item" : "items"}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="flex h-10 items-center gap-2 border border-border px-3 text-sm lg:hidden"
        >
          <SlidersHorizontal className="size-4" strokeWidth={1.5} />
          Filter
        </button>
        <PlpSortSelect value={sort} onChange={onSortChange} />
      </div>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-full border-none bg-luxe-white p-0 sm:max-w-sm">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
            <SheetTitle className="font-heading text-lg tracking-[0.1em] uppercase">Filter</SheetTitle>
            <SheetClose aria-label="Close filters">
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
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
