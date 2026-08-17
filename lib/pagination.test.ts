import { describe, expect, it } from "vitest";
import { buildPageHref, pageWindow, parsePage, parseSearch, resolvePage } from "@/lib/pagination";

describe("parsePage", () => {
  it("defaults to 1 for anything unusable", () => {
    // The value comes from a URL a human can type, so none of these may throw or
    // produce a negative OFFSET.
    for (const input of [undefined, "", "0", "-3", "abc", "NaN", "1e999"]) {
      expect(parsePage(input)).toBe(1);
    }
  });

  it("reads a real page number, including from a repeated param", () => {
    expect(parsePage("4")).toBe(4);
    expect(parsePage(["7", "9"])).toBe(7);
    expect(parsePage("3.9")).toBe(3);
  });
});

describe("parseSearch", () => {
  it("trims and tolerates absence", () => {
    expect(parseSearch("  boots ")).toBe("boots");
    expect(parseSearch(undefined)).toBe("");
  });
});

describe("resolvePage", () => {
  it("computes the offset for a middle page", () => {
    expect(resolvePage(100, { page: 3, pageSize: 25 })).toEqual({ page: 3, pageCount: 4, skip: 50, take: 25 });
  });

  it("clamps past the end, so deleting the last row does not strand the viewer", () => {
    // 26 rows over 25 per page is 2 pages; asking for page 9 must land on 2, not on an
    // empty table with no way back.
    expect(resolvePage(26, { page: 9, pageSize: 25 })).toMatchObject({ page: 2, pageCount: 2, skip: 25 });
  });

  it("keeps one page when there is nothing to show", () => {
    expect(resolvePage(0, { page: 1, pageSize: 25 })).toMatchObject({ page: 1, pageCount: 1, skip: 0 });
  });
});

describe("pageWindow", () => {
  it("never exceeds the span and always contains the current page", () => {
    for (const page of [1, 5, 12, 20]) {
      const window = pageWindow(page, 20, 5);
      expect(window.length).toBe(5);
      expect(window).toContain(page);
    }
  });

  it("shrinks to what exists", () => {
    expect(pageWindow(1, 3, 5)).toEqual([1, 2, 3]);
  });

  it("stays inside the bounds at both ends", () => {
    expect(pageWindow(1, 20, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(20, 20, 5)).toEqual([16, 17, 18, 19, 20]);
  });
});

describe("buildPageHref", () => {
  it("carries existing filters across a page change", () => {
    // The bug this prevents: paging that silently drops the search or status filter.
    expect(buildPageHref("/admin/orders", { q: "smith", status: "shipped" }, 3)).toBe(
      "/admin/orders?q=smith&status=shipped&page=3"
    );
  });

  it("omits page=1 and empty params, so the canonical URL stays clean", () => {
    expect(buildPageHref("/admin/orders", { q: "", status: undefined }, 1)).toBe("/admin/orders");
  });

  it("escapes values", () => {
    expect(buildPageHref("/admin/orders", { q: "a b&c" }, 1)).toBe("/admin/orders?q=a+b%26c");
  });
});
