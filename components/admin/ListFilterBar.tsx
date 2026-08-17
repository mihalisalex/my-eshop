import { Search } from "lucide-react";

interface SelectFilter {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

interface ListFilterBarProps {
  /** The page's own path — this submits as a GET, so filters land in the URL. */
  action: string;
  searchName?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  selects?: SelectFilter[];
}

/**
 * A plain GET form. No client component, no debounced fetch, no state to keep in sync:
 * submitting puts the filters in the query string, the server re-renders from them, and
 * the resulting URL is shareable and survives a refresh — which is exactly what the
 * audit asked for of the storefront filters and was missing entirely from the admin.
 *
 * `page` is deliberately NOT carried through: changing a filter should return you to
 * page 1, since page 7 of the old result set means nothing in the new one.
 */
export function ListFilterBar({
  action,
  searchName = "q",
  searchValue = "",
  searchPlaceholder = "Search…",
  selects = [],
}: ListFilterBarProps) {
  const controlClass =
    "h-9 border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black";

  return (
    <form method="get" action={action} className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-luxe-gray-dark"
          strokeWidth={1.5}
        />
        <input
          type="search"
          name={searchName}
          defaultValue={searchValue}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className={`${controlClass} w-full pl-9`}
        />
      </div>

      {selects.map((select) => (
        <select key={select.name} name={select.name} defaultValue={select.value} aria-label={select.label} className={controlClass}>
          <option value="">{select.label}</option>
          {select.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ))}

      <button
        type="submit"
        className="h-9 border border-luxe-black px-4 text-xs font-medium tracking-[0.05em] uppercase"
      >
        Apply
      </button>
      {searchValue || selects.some((select) => select.value) ? (
        <a href={action} className="h-9 px-2 text-xs leading-9 text-luxe-gray-dark underline underline-offset-2">
          Clear
        </a>
      ) : null}
    </form>
  );
}
