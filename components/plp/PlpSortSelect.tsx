"use client";

import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
] as const;

export type PlpSort = (typeof SORT_OPTIONS)[number]["value"];

interface PlpSortSelectProps {
  value: PlpSort;
  onChange: (value: PlpSort) => void;
  className?: string;
}

export function PlpSortSelect({ value, onChange, className }: PlpSortSelectProps) {
  return (
    <select
      aria-label="Sort products"
      value={value}
      onChange={(event) => onChange(event.target.value as PlpSort)}
      className={cn(
        "h-10 border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black",
        className
      )}
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
