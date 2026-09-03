import { describe, expect, it } from "vitest";
import { isOwnBlobUrl, safeUploadFilename } from "@/lib/blob";

/**
 * The uploaded filename ends up in a public object key, so it stops being the uploader's
 * text before it gets there. Only the sanitiser is unit-testable here — the magic-byte
 * check needs a real File and lives with the upload route.
 */
describe("safeUploadFilename", () => {
  it("keeps an ordinary product photo name intact", () => {
    expect(safeUploadFilename("loafer-black-01.jpg")).toBe("loafer-black-01.jpg");
  });

  it("drops any directory part, including traversal", () => {
    expect(safeUploadFilename("../../etc/passwd")).toBe("passwd");
    expect(safeUploadFilename("C:\\Users\\me\\shoe.png")).toBe("shoe.png");
  });

  it("replaces characters that would change how a URL parses", () => {
    expect(safeUploadFilename("sh oe?a=1&b=2.jpg")).toBe("sh-oe-a-1-b-2.jpg");
    expect(safeUploadFilename("photo%2e%2e.png")).toBe("photo-2e-2e.png");
  });

  it("keeps the extension when the name itself is entirely non-ASCII", () => {
    // The catalogue is Greek, so this is the common case, not an edge one. Sanitising the
    // whole string in one pass used to reduce this to "jpg", eating the extension.
    const out = safeUploadFilename("παπούτσι.jpg");
    expect(out).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(out.endsWith(".jpg")).toBe(true);
  });

  it("never returns a name that starts or ends with a dot or a dash", () => {
    expect(safeUploadFilename(".htaccess")).toBe("htaccess");
    expect(safeUploadFilename("---x.png")).toBe("x.png");
    expect(safeUploadFilename("x-.png")).toBe("x.png");
  });

  it("collapses runs of separators rather than emitting a long hyphen chain", () => {
    expect(safeUploadFilename("a    b.png")).toBe("a-b.png");
  });

  it("always returns something usable, even for a name with nothing left", () => {
    expect(safeUploadFilename("???")).toBe("upload");
    expect(safeUploadFilename("")).toBe("upload");
    expect(safeUploadFilename("???.jpg")).toBe("upload.jpg");
  });

  it("bounds the length so the key stays reasonable", () => {
    expect(safeUploadFilename(`${"a".repeat(500)}.jpg`).length).toBeLessThanOrEqual(80);
  });
});

describe("isOwnBlobUrl", () => {
  it("accepts this shop's own Blob store, whatever its store id", () => {
    // The real host, seen in the catalogue today.
    expect(isOwnBlobUrl("https://266dzyztwtian1su.public.blob.vercel-storage.com/products/x.jpg")).toBe(true);
    // A different store id must still match — the rename route must not need updating if
    // the project is ever moved to a new Blob store.
    expect(isOwnBlobUrl("https://anotherstoreid123.public.blob.vercel-storage.com/x.jpg")).toBe(true);
  });

  it("rejects the hosts this shop merely displays images from", () => {
    // The WooCommerce import's original host and a random image URL — this shop stores
    // neither, and renaming a file it does not own would either fail loudly against a host
    // that isn't ours, or worse, silently do nothing useful.
    expect(isOwnBlobUrl("https://alexandrisstores.gr/wp-content/uploads/x.jpg")).toBe(false);
    expect(isOwnBlobUrl("https://images.unsplash.com/photo-1.jpg")).toBe(false);
  });

  it("rejects a host that merely contains the right suffix as a lookalike", () => {
    // "evilpublic.blob.vercel-storage.com.evil.com" must not pass a naive endsWith check
    // on the wrong string — this asserts the real hostname, not a substring of the URL.
    expect(isOwnBlobUrl("https://evil.com/public.blob.vercel-storage.com/x.jpg")).toBe(false);
  });

  it("does not throw on a malformed URL", () => {
    expect(isOwnBlobUrl("not a url")).toBe(false);
    expect(isOwnBlobUrl("")).toBe(false);
  });
});
