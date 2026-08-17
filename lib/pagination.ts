/**
 * Shared paging arithmetic and URL handling for the admin lists.
 *
 * Every admin list previously rendered its entire table: 175 products (filtered
 * client-side), 1,050 inventory rows, 317 media assets, and every order ever placed.
 * That is workable at today's volumes and stops being workable without warning — the
 * inventory page already ships a thousand rows of markup on every view, and the orders
 * page had no search either, so finding one order meant Ctrl-F on the whole table.
 *
 * Deliberately plain: page/pageSize/total in, offsets and a clamped page out. No cursor
 * pagination — these lists are sorted by a mutable column (status, stock) and jumped
 * around by page number, which is exactly the case offsets suit.
 */

export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export const DEFAULT_PAGE_SIZE = 25;

/**
 * Reads `?page=` defensively. Anything absent, non-numeric, zero or negative becomes
 * page 1 rather than throwing or producing a negative OFFSET — the value arrives from a
 * URL a human can type.
 */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

export function parseSearch(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

/**
 * Clamps the requested page to what actually exists, so deleting the last row on page 9
 * shows page 8 rather than an empty table with no way back.
 */
export function resolvePage(total: number, request: PageRequest) {
  const pageCount = Math.max(1, Math.ceil(total / request.pageSize));
  const page = Math.min(Math.max(request.page, 1), pageCount);
  return { page, pageCount, skip: (page - 1) * request.pageSize, take: request.pageSize };
}

export function toPaged<T>(rows: T[], total: number, page: number, pageSize: number): Paged<T> {
  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** The window of page numbers to render, always at most `span` wide and always including the current page. */
export function pageWindow(page: number, pageCount: number, span = 5): number[] {
  const half = Math.floor(span / 2);
  let start = Math.max(1, page - half);
  const end = Math.min(pageCount, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

/** Preserves every existing query parameter while changing one — filters must survive paging. */
export function buildPageHref(basePath: string, params: Record<string, string | undefined>, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}
