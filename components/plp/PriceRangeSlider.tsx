"use client";

import { formatMoney } from "@/lib/format";

interface PriceRangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}

export function PriceRangeSlider({ min, max, value, onChange }: PriceRangeSliderProps) {
  const [low, high] = value;
  const range = Math.max(max - min, 1);
  const lowPercent = ((low - min) / range) * 100;
  const highPercent = ((high - min) / range) * 100;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-luxe-gray-dark">
        <span>{formatMoney({ amount: low, currencyCode: "EUR" })}</span>
        <span>{formatMoney({ amount: high, currencyCode: "EUR" })}</span>
      </div>
      <div className="relative h-4">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-border" />
        <div
          className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-luxe-black"
          style={{ left: `${lowPercent}%`, right: `${100 - highPercent}%` }}
        />
        <input
          type="range"
          aria-label="Minimum price"
          min={min}
          max={max}
          value={low}
          onChange={(event) => {
            const next = Math.min(Number(event.target.value), high);
            onChange([next, high]);
          }}
          className="range-thumb pointer-events-none absolute inset-x-0 top-1/2 h-4 w-full -translate-y-1/2 appearance-none bg-transparent"
        />
        <input
          type="range"
          aria-label="Maximum price"
          min={min}
          max={max}
          value={high}
          onChange={(event) => {
            const next = Math.max(Number(event.target.value), low);
            onChange([low, next]);
          }}
          className="range-thumb pointer-events-none absolute inset-x-0 top-1/2 h-4 w-full -translate-y-1/2 appearance-none bg-transparent"
        />
      </div>
    </div>
  );
}
