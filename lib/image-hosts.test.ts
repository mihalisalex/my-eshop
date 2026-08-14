import { describe, expect, it } from "vitest";
import { isOptimizableImageUrl } from "@/lib/image-hosts";

/**
 * This gates a fatal error path: passing an unconfigured host to next/image throws and
 * takes down the whole route, so a false positive here is a broken page, not a slow image.
 */
describe("isOptimizableImageUrl", () => {
  it("accepts an exactly-matching configured host", () => {
    expect(isOptimizableImageUrl("https://images.unsplash.com/photo-123.jpg")).toBe(true);
    expect(isOptimizableImageUrl("https://alexandrisstores.gr/wp-content/a.jpg")).toBe(true);
  });

  it("accepts a single-label subdomain against a wildcard pattern", () => {
    expect(isOptimizableImageUrl("https://abc123.public.blob.vercel-storage.com/products/x.jpg")).toBe(true);
  });

  it("rejects a multi-label subdomain, matching Next's own wildcard semantics", () => {
    // `*.` matches one label; `a.b.public...` must not slip through.
    expect(isOptimizableImageUrl("https://a.b.public.blob.vercel-storage.com/x.jpg")).toBe(false);
  });

  it("rejects a lookalike host that merely ends with the pattern", () => {
    expect(isOptimizableImageUrl("https://evilpublic.blob.vercel-storage.com/x.jpg")).toBe(false);
    expect(isOptimizableImageUrl("https://notalexandrisstores.gr/x.jpg")).toBe(false);
  });

  it("rejects the bare wildcard suffix with no subdomain label", () => {
    expect(isOptimizableImageUrl("https://public.blob.vercel-storage.com/x.jpg")).toBe(false);
  });

  it("rejects unconfigured hosts, which is the case that would otherwise crash the page", () => {
    expect(isOptimizableImageUrl("https://example.invalid/a.jpg")).toBe(false);
    expect(isOptimizableImageUrl("https://www.alexandris-demo.example/logo.svg")).toBe(false);
  });

  it("rejects non-https and unparseable values instead of throwing", () => {
    expect(isOptimizableImageUrl("http://images.unsplash.com/a.jpg")).toBe(false);
    expect(isOptimizableImageUrl("not a url")).toBe(false);
    expect(isOptimizableImageUrl("")).toBe(false);
  });
});
