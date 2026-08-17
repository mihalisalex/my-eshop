import { describe, expect, it } from "vitest";
import { normalizeSeoOverride } from "@/lib/validation/product";

/**
 * Guards the empty-string-is-not-absent bug: react-hook-form materialises
 * `seo.title`/`seo.description` as "" when the optional SEO block is left untouched,
 * and every read site used `?? product.name`, which does not fall back on "". A
 * product saved through the admin form therefore rendered `<title> | Alexandris
 * Stores</title>` with no meta description, silently, one product per edit.
 */
describe("normalizeSeoOverride", () => {
  it("collapses an all-blank override to undefined, which is what the ?? fallbacks expect", () => {
    expect(normalizeSeoOverride({ title: "", description: "" })).toBeUndefined();
  });

  it("collapses whitespace-only fields too", () => {
    expect(normalizeSeoOverride({ title: "   ", description: "\n\t" })).toBeUndefined();
  });

  it("drops only the blank fields when some are genuinely set", () => {
    expect(normalizeSeoOverride({ title: "Real title", description: "" })).toEqual({
      title: "Real title",
    });
  });

  it("trims values it keeps", () => {
    expect(normalizeSeoOverride({ title: "  Padded  " })).toEqual({ title: "Padded" });
  });

  it("keeps a fully populated override intact", () => {
    const seo = { title: "T", description: "D", ogImage: "https://example.com/a.jpg" };
    expect(normalizeSeoOverride(seo)).toEqual(seo);
  });

  it("passes null and undefined straight through", () => {
    expect(normalizeSeoOverride(null)).toBeUndefined();
    expect(normalizeSeoOverride(undefined)).toBeUndefined();
  });

  it("does not treat an empty object as a stored override", () => {
    expect(normalizeSeoOverride({})).toBeUndefined();
  });
});
