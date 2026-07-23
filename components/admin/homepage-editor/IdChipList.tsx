"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";

interface IdChipListProps {
  label: string;
  ids: string[];
  onChange: (next: string[]) => void;
}

/** Reorder / remove the product or collection ids a section references. Adding new ones needs a real picker — out of scope for this foundation. */
export function IdChipList({ label, ids, onChange }: IdChipListProps) {
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(ids.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-luxe-gray-dark uppercase">{label}</label>
      <ul className="space-y-1.5">
        {ids.map((id, index) => (
          <li key={id} className="flex items-center gap-2 border border-border px-3 py-1.5 text-sm">
            <span className="font-mono text-xs text-luxe-gray-dark">{index + 1}.</span>
            <span className="flex-1">{id}</span>
            <button
              type="button"
              aria-label="Move up"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              className="disabled:opacity-30"
            >
              <ArrowUp className="size-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={index === ids.length - 1}
              onClick={() => move(index, 1)}
              className="disabled:opacity-30"
            >
              <ArrowDown className="size-3.5" strokeWidth={1.5} />
            </button>
            <button type="button" aria-label="Remove" onClick={() => remove(index)}>
              <X className="size-3.5" strokeWidth={1.5} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
