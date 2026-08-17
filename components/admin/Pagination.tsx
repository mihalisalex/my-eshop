import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildPageHref, pageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";

interface PaginationProps {
  basePath: string;
  /** Every other query parameter in play, so paging never drops the active filters. */
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  /** What the rows are, for the "Showing 1–25 of 340 orders" line. */
  label: string;
}

/**
 * Server-rendered paging: plain links, no client JS, so it works before hydration and a
 * page is a real URL that can be bookmarked, shared and opened in a new tab.
 */
export function Pagination({ basePath, params, page, pageCount, total, pageSize, label }: PaginationProps) {
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const linkClass =
    "flex h-9 min-w-9 items-center justify-center border border-border px-2 text-xs tabular-nums transition-colors hover:border-luxe-black";

  return (
    <nav
      aria-label={`${label} pagination`}
      className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row"
    >
      <p className="text-xs text-luxe-gray-dark tabular-nums">
        Showing {first}–{last} of {total} {label}
      </p>

      {pageCount > 1 ? (
        <div className="flex items-center gap-1.5">
          {page > 1 ? (
            <Link href={buildPageHref(basePath, params, page - 1)} className={linkClass} aria-label="Previous page">
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </Link>
          ) : (
            <span className={cn(linkClass, "opacity-30")} aria-hidden="true">
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </span>
          )}

          {pageWindow(page, pageCount).map((candidate) => (
            <Link
              key={candidate}
              href={buildPageHref(basePath, params, candidate)}
              aria-current={candidate === page ? "page" : undefined}
              className={cn(linkClass, candidate === page && "border-luxe-black font-medium")}
            >
              {candidate}
            </Link>
          ))}

          {page < pageCount ? (
            <Link href={buildPageHref(basePath, params, page + 1)} className={linkClass} aria-label="Next page">
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </Link>
          ) : (
            <span className={cn(linkClass, "opacity-30")} aria-hidden="true">
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </span>
          )}
        </div>
      ) : null}
    </nav>
  );
}
