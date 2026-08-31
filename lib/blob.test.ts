import { describe, expect, it } from "vitest";
import { safeUploadFilename } from "@/lib/blob";

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
