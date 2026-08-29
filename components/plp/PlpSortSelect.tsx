"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Values are stable identifiers that travel in the URL (`?sort=price-asc`) and reach the
 * server; the labels are translated at render. They were hard-coded English on a shop whose
 * default language is Greek, and this control sits on every listing page.
 */
const SORT_VALUES = ["relevance", "newest", "discount", "price-asc", "price-desc"] as const;

export type PlpSort = (typeof SORT_VALUES)[number];

/** Message keys under `PlpSort` — kept explicit so a renamed key is a type error, not a blank option. */
const SORT_LABEL_KEY: Record<PlpSort, string> = {
  relevance: "relevance",
  newest: "newest",
  discount: "discount",
  "price-asc": "priceAsc",
  "price-desc": "priceDesc",
};

interface PlpSortSelectProps {
  value: PlpSort;
  onChange: (value: PlpSort) => void;
  className?: string;
}

export function PlpSortSelect({ value, onChange, className }: PlpSortSelectProps) {
  const t = useTranslations("PlpSort");

  return (
    <select
      aria-label={t("sortProducts")}
      value={value}
      onChange={(event) => onChange(event.target.value as PlpSort)}
      className={cn(
        "h-10 border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black",
        className
      )}
    >
      {SORT_VALUES.map((option) => (
        <option key={option} value={option}>
          {t(SORT_LABEL_KEY[option])}
        </option>
      ))}
    </select>
  );
}
