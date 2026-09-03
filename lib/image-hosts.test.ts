import { describe, expect, it } from "vitest";
import { isOptimizableImageUrl, REMOTE_IMAGE_HOSTS } from "@/lib/image-hosts";

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

  it("accepts any depth of subdomain against a `**.` pattern", () => {
    // Meta serves the same feed from hosts of differing depth, and which one a given photo
    // comes from is not ours to predict — a `*.` pattern here would work in testing and
    // then reject an image in production.
    expect(isOptimizableImageUrl("https://scontent.cdninstagram.com/v/t51/x.jpg")).toBe(true);
    expect(isOptimizableImageUrl("https://scontent-ath3-1.cdninstagram.com/v/t51/x.jpg")).toBe(true);
    expect(isOptimizableImageUrl("https://scontent-fra5-2.xx.fbcdn.net/v/t51/x.jpg")).toBe(true);
  });

  it("rejects the apex domain of a `**.` pattern, which has no subdomain at all", () => {
    expect(isOptimizableImageUrl("https://fbcdn.net/x.jpg")).toBe(false);
    expect(isOptimizableImageUrl("https://cdninstagram.com/x.jpg")).toBe(false);
  });

  it("rejects a lookalike host that merely ends with the pattern", () => {
    expect(isOptimizableImageUrl("https://evilcdninstagram.com/x.jpg")).toBe(false);
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

describe("CSP source derivation (SEC-005)", () => {
  /**
   * `remotePatterns` and CSP do not share a wildcard syntax. Next uses `*.` for exactly one
   * label and `**.` for one or more; CSP has only `*.`, which already matches any depth.
   * Emitting `**.` produces an INVALID source that the browser discards silently — the
   * console says "contains an invalid source: … It will be ignored" and the host ends up
   * blocked despite appearing in the policy.
   *
   * This mirrors the transform in next.config.ts. Kept here so adding a `**.` host to the
   * list can never again quietly produce a policy line that does nothing.
   */
  const toCspSource = (hostname: string) => hostname.replace(/^\*\*\./, "*.");

  it("collapses Next's one-or-more wildcard to CSP's single form", () => {
    expect(toCspSource("**.cdninstagram.com")).toBe("*.cdninstagram.com");
    expect(toCspSource("**.fbcdn.net")).toBe("*.fbcdn.net");
  });

  it("leaves a single-label wildcard and a plain host untouched", () => {
    expect(toCspSource("*.public.blob.vercel-storage.com")).toBe("*.public.blob.vercel-storage.com");
    expect(toCspSource("images.unsplash.com")).toBe("images.unsplash.com");
  });

  it("emits no `**` for any configured host, which is what the browser rejects", () => {
    for (const host of REMOTE_IMAGE_HOSTS) {
      expect(toCspSource(host.hostname)).not.toContain("**");
    }
  });
});
