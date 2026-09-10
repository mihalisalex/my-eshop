import { NextResponse, type NextRequest } from "next/server";
import { searchProducts, searchSuggestions } from "@/services/search";
import { enforceRateLimit } from "@/lib/rate-limit";
import { commerceErrorResponse } from "@/lib/commerce/http-errors";
import type { SearchOptions } from "@/lib/commerce/types";

/**
 * The storefront's search endpoint.
 *
 * Replaces the pattern where the browser pulled the whole scoped catalog from
 * `/api/products` and filtered it in JavaScript. One request now returns one page of
 * products plus the facet counts and price bounds, so a listing page no longer downloads
 * 200 KB before showing its first card.
 *
 * `pageSize` is capped: it is a public, unauthenticated endpoint, and an uncapped page
 * size would just recreate the full-catalog download this exists to remove.
 */
const MAX_PAGE_SIZE = 60;

function csv(value: string | null): string[] | undefined {
  const parts = value?.split(",").map((entry) => entry.trim()).filter(Boolean);
  return parts && parts.length > 0 ? parts : undefined;
}

function numeric(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const SORTS = new Set(["oldest", "newest", "discount", "price-asc", "price-desc"]);

/**
 * `relevance` was this sort's name until it was renamed to say what it does. Anything already
 * carrying the old value in a URL — a bookmark, a shared link, a page open in another tab —
 * still means the same ordering, so it is translated rather than dropped on the floor and
 * silently answered in a different order.
 */
const LEGACY_SORTS: Record<string, string> = { relevance: "oldest" };

export async function GET(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, { name: "search", limit: 300, windowMs: 10 * 60 * 1000 });
    if (limited) return limited;

    const params = request.nextUrl.searchParams;
    const query = params.get("q") ?? "";

    if (params.get("suggestions") === "true") {
      const limit = Math.min(numeric(params.get("limit")) ?? 5, 10);
      return NextResponse.json({ suggestions: await searchSuggestions(query, limit) });
    }

    const rawSort = params.get("sort");
    const sort = rawSort ? (LEGACY_SORTS[rawSort] ?? rawSort) : null;
    const options: SearchOptions = {
      category: params.get("category") ?? undefined,
      gender: (params.get("gender") as SearchOptions["gender"]) ?? undefined,
      collectionId: params.get("collectionId") ?? undefined,
      genders: csv(params.get("genders")),
      colors: csv(params.get("colors")),
      sizes: csv(params.get("sizes")),
      brands: csv(params.get("brands")),
      tags: csv(params.get("tags")),
      availability: params.get("availability") === "in-stock" ? "in-stock" : "all",
      isNew: params.get("isNew") === "true",
      isSale: params.get("isSale") === "true",
      minPrice: numeric(params.get("minPrice")),
      maxPrice: numeric(params.get("maxPrice")),
      // Matches the listing components' default, so a request that omits `sort` gets the same
      // order the page was rendered in rather than silently falling back to oldest-first.
      sort: sort && SORTS.has(sort) ? (sort as SearchOptions["sort"]) : "newest",
      page: Math.max(1, numeric(params.get("page")) ?? 1),
      pageSize: Math.min(numeric(params.get("pageSize")) ?? 24, MAX_PAGE_SIZE),
    };

    return NextResponse.json(await searchProducts(query, options));
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
