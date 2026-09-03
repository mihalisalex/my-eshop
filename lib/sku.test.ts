import { describe, expect, it } from "vitest";
import { deriveSizeSku, isDerivedSizeSku } from "@/lib/sku";

describe("deriveSizeSku", () => {
  it("joins the product SKU to the size", () => {
    expect(deriveSizeSku("9262", "36")).toBe("9262-36");
    expect(deriveSizeSku("9262", "37")).toBe("9262-37");
  });

  it("handles the catalogue's other SKU shapes", () => {
    // Both are real: WooCommerce-imported codes and hand-numbered ones with a suffix.
    expect(deriveSizeSku("WC-12978", "41")).toBe("WC-12978-41");
    expect(deriveSizeSku("145-1", "40")).toBe("145-1-40");
  });

  it("derives nothing when either half is missing", () => {
    expect(deriveSizeSku("", "36")).toBeNull();
    expect(deriveSizeSku("9262", "")).toBeNull();
    expect(deriveSizeSku(undefined, undefined)).toBeNull();
    // A row the merchandiser has not named yet must not become "9262-".
    expect(deriveSizeSku("9262", "   ")).toBeNull();
  });
});

describe("isDerivedSizeSku", () => {
  it("treats an empty SKU as free to fill", () => {
    expect(isDerivedSizeSku("", "9262", "36")).toBe(true);
    expect(isDerivedSizeSku(undefined, "9262", "36")).toBe(true);
  });

  it("keeps ownership when the PRODUCT sku changes", () => {
    // Product renumbered 9262 → 9270; the row still holds 9262-36.
    expect(isDerivedSizeSku("9262-36", "9270", "36")).toBe(true);
  });

  it("keeps ownership when the SIZE changes mid-typing", () => {
    // Row renamed 3 → 36 while holding 9262-3, which matches no size but is still ours.
    expect(isDerivedSizeSku("9262-3", "9262", "36")).toBe(true);
  });

  it("leaves a supplier's own code alone", () => {
    expect(isDerivedSizeSku("ACME-XYZ-9", "9262", "36")).toBe(false);
    expect(isDerivedSizeSku("2225-1-1", "WC-13135", "41")).toBe(false);
  });

  it("does not claim a code just because the product SKU is blank", () => {
    // Otherwise clearing the SKU field would make every supplier code rewritable.
    expect(isDerivedSizeSku("ACME-XYZ-9", "", "36")).toBe(false);
  });
});
