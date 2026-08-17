"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const controlClass =
  "h-9 w-full border border-border bg-transparent px-2 text-xs outline-none focus:border-luxe-black";

/**
 * URL-driven filters (§24). State lives in the query string rather than component
 * state so a filtered view can be bookmarked, shared with a colleague, or reloaded
 * — and because the filtering itself happens in the database, the server needs to
 * see it anyway.
 */
export function PaymentFilters({
  providers,
  methods,
  statuses,
}: {
  providers: { id: string; name: string }[];
  methods: { id: string; name: string }[];
  statuses: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const hasFilters = ["provider", "method", "status", "order", "customer", "from", "to"].some((key) =>
    searchParams.get(key)
  );

  return (
    <div className="border border-border bg-luxe-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Select
          label="Provider"
          value={searchParams.get("provider") ?? ""}
          onChange={(value) => setParam("provider", value)}
          options={providers.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Select
          label="Method"
          value={searchParams.get("method") ?? ""}
          onChange={(value) => setParam("method", value)}
          options={methods.map((m) => ({ value: m.id, label: m.name }))}
        />
        <Select
          label="Status"
          value={searchParams.get("status") ?? ""}
          onChange={(value) => setParam("status", value)}
          options={statuses}
        />
        <Text
          label="Order ID"
          value={searchParams.get("order") ?? ""}
          onCommit={(value) => setParam("order", value)}
        />
        <Text
          label="Customer email"
          value={searchParams.get("customer") ?? ""}
          onCommit={(value) => setParam("customer", value)}
        />
        <Date label="From" value={searchParams.get("from") ?? ""} onChange={(value) => setParam("from", value)} />
        <Date label="To" value={searchParams.get("to") ?? ""} onChange={(value) => setParam("to", value)} />
      </div>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => router.replace(pathname)}
          className="mt-3 inline-flex items-center gap-1 text-xs text-luxe-gray-dark underline underline-offset-4 hover:text-luxe-black"
        >
          <X className="size-3" strokeWidth={1.5} />
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[10px] tracking-[0.05em] text-luxe-gray-dark uppercase">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(controlClass, "appearance-none")}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Commits on blur/Enter rather than per keystroke, so typing an email doesn't fire a query per character. */
function Text({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  const id = `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[10px] tracking-[0.05em] text-luxe-gray-dark uppercase">
        {label}
      </label>
      <input
        id={id}
        defaultValue={value}
        onBlur={(e) => onCommit(e.target.value.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit((e.target as HTMLInputElement).value.trim());
          }
        }}
        className={controlClass}
      />
    </div>
  );
}

function Date({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[10px] tracking-[0.05em] text-luxe-gray-dark uppercase">
        {label}
      </label>
      <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className={controlClass} />
    </div>
  );
}
