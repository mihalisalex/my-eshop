"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { PriceRangeSlider } from "@/components/plp/PriceRangeSlider";
import type { SearchFacet } from "@/lib/commerce/types";

export interface PlpFilters {
  colors: string[];
  sizes: string[];
  availability: "in-stock" | "all";
  priceRange: [number, number];
  /** null means "all" — the scope's own genders, unfiltered. */
  gender: string | null;
}

interface PlpFilterSidebarProps {
  facets: SearchFacet[];
  priceBounds: [number, number];
  filters: PlpFilters;
  onChange: (patch: Partial<PlpFilters>) => void;
  onClearAll: () => void;
  /** Set false when the parent (e.g. the mobile filter sheet) already renders a "Filter" title. */
  showTitle?: boolean;
  /**
   * Hidden on a listing that is already one gender. /women pins gender in its baseFilters,
   * so offering the choice there would either be a no-op or would contradict the page's own
   * heading — the facet would show a single value with the full count next to it.
   */
  showGender?: boolean;
}

function getFacetValues(facets: SearchFacet[], key: string) {
  return facets.find((facet) => facet.key === key)?.values ?? [];
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const GENDER_LABEL: Record<string, string> = {
  women: "genderWomen",
  men: "genderMen",
  unisex: "genderUnisex",
};

export function PlpFilterSidebar({ facets, priceBounds, filters, onChange, onClearAll, showTitle = true, showGender = false }: PlpFilterSidebarProps) {
  const t = useTranslations("Plp");
  const colorFacets = getFacetValues(facets, "color");
  const sizeFacets = getFacetValues(facets, "size");
  // Only worth a control when the scope actually holds more than one gender. A collection of
  // women's shoes would otherwise render a "For" group with one option in it.
  const genderFacets = showGender ? getFacetValues(facets, "gender") : [];
  const hasActiveFilters =
    filters.colors.length > 0 ||
    filters.sizes.length > 0 ||
    filters.availability === "in-stock" ||
    filters.gender !== null ||
    filters.priceRange[0] !== priceBounds[0] ||
    filters.priceRange[1] !== priceBounds[1];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        {showTitle ? <p className="text-eyebrow">{t("filter")}</p> : <span />}
        {hasActiveFilters ? (
          <button type="button" onClick={onClearAll} className="text-xs underline underline-offset-4 hover:text-luxe-black">
            {t("clearAll")}
          </button>
        ) : null}
      </div>

      {genderFacets.length > 1 ? (
        <div>
          <p className="mb-3 text-sm font-medium">{t("gender")}</p>
          <div className="flex flex-wrap gap-2">
            {[{ value: null as string | null, count: genderFacets.reduce((sum, f) => sum + f.count, 0) }, ...genderFacets].map(
              ({ value, count }) => {
                const active = filters.gender === value;
                return (
                  <button
                    key={value ?? "all"}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChange({ gender: value })}
                    className={cn(
                      "border px-3 py-1.5 text-xs transition-colors",
                      active ? "border-luxe-black bg-luxe-black text-luxe-white" : "border-border hover:border-luxe-black"
                    )}
                  >
                    {value === null ? t("allGenders") : t(GENDER_LABEL[value] ?? "genderUnisex")} ({count})
                  </button>
                );
              }
            )}
          </div>
        </div>
      ) : null}

      {colorFacets.length > 0 ? (
        <div>
          <p className="mb-3 text-sm font-medium">{t("color")}</p>
          <div className="flex flex-wrap gap-2">
            {colorFacets.map(({ value, count }) => {
              const active = filters.colors.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ colors: toggle(filters.colors, value) })}
                  className={cn(
                    "border px-3 py-1.5 text-xs transition-colors",
                    active ? "border-luxe-black bg-luxe-black text-luxe-white" : "border-border hover:border-luxe-black"
                  )}
                >
                  {value} ({count})
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {sizeFacets.length > 0 ? (
        <div>
          <p className="mb-3 text-sm font-medium">{t("size")}</p>
          <div className="flex flex-wrap gap-2">
            {sizeFacets.map(({ value }) => {
              const active = filters.sizes.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ sizes: toggle(filters.sizes, value) })}
                  className={cn(
                    "flex h-9 min-w-9 items-center justify-center border px-2 text-xs transition-colors",
                    active ? "border-luxe-black bg-luxe-black text-luxe-white" : "border-border hover:border-luxe-black"
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-3 text-sm font-medium">{t("price")}</p>
        <PriceRangeSlider
          min={priceBounds[0]}
          max={priceBounds[1]}
          value={filters.priceRange}
          onChange={(priceRange) => onChange({ priceRange })}
        />
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">{t("availability")}</p>
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={filters.availability === "in-stock"}
            onChange={(event) => onChange({ availability: event.target.checked ? "in-stock" : "all" })}
            className="size-4 border-border accent-luxe-black"
          />
          {t("inStockOnly")}
        </label>
      </div>
    </div>
  );
}
