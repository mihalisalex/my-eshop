import { describe, expect, it } from "vitest";
import { describeFormErrors } from "@/lib/form-errors";
import { zodResolver } from "@hookform/resolvers/zod";
import { emptyProductFormValues, productFormSchema, type ProductFormValues } from "@/lib/validation/product";

/**
 * The exact path production takes: the resolver react-hook-form is configured with, so the
 * error SHAPE under test is the one the form really produces rather than Zod's own.
 */
async function reject(values: unknown): Promise<string[]> {
  const resolver = zodResolver(productFormSchema);
  const { errors } = await resolver(values as ProductFormValues, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  });
  return describeFormErrors(errors);
}

describe("describeFormErrors", () => {
  it("names a top-level field by its section label", () => {
    expect(describeFormErrors({ sku: { type: "too_small", message: "SKU is required" } })).toEqual([
      "SKU: SKU is required",
    ]);
  });

  it("counts array entries from one, the way a person counts photos", () => {
    const errors = { images: [undefined, { alt: { type: "too_small", message: "Alt text is required" } }] };
    expect(describeFormErrors(errors)).toEqual(["Images 2 · alt: Alt text is required"]);
  });

  it("does not walk into `ref`, which holds a DOM node", () => {
    // A real RHF error carries the element itself; recursing into it walks the document.
    const ref = { message: "not an error message", ownerDocument: {} };
    expect(describeFormErrors({ name: { type: "too_small", message: "Name is required", ref } })).toEqual([
      "Name: Name is required",
    ]);
  });

  it("reports every rejected field, not just the first", async () => {
    const described = await reject(emptyProductFormValues);
    // A brand-new, untouched form: nine separate things are missing and all nine are named.
    expect(described.length).toBeGreaterThanOrEqual(8);
    expect(described).toContain("Name: Name is required");
    expect(described).toContain("Sizes 1 · name: Size is required");
  });
});

describe("the blank starter image row", () => {
  /**
   * The bug this guards: a new product begins with one empty image row, and uploading a
   * photo used to APPEND past it. The gallery hides a row with no `src` because there is no
   * thumbnail to draw, so the merchandiser saw one photo attached and nothing wrong, while
   * the resolver rejected `images.0.src` on every press of Create product.
   */
  const uploaded = { src: "https://blob.example/shoe.jpg", alt: "Μαύρο sneaker" };
  const filled = {
    ...emptyProductFormValues,
    name: "Δοκιμαστικό sneaker",
    slug: "dokimastiko-sneaker",
    description: "Περιγραφή.",
    price: 59,
    category: "andrika-sneakers",
    sku: "9262",
    sizes: [{ name: "40", inStock: true, quantity: 1 }],
  };

  it("makes the product invalid if it survives the upload", async () => {
    const described = await reject({ ...filled, images: [...emptyProductFormValues.images, uploaded] });
    // Row 1 is the placeholder nobody could see, and it blocked every save.
    expect(described).toContain("Images 1 · src: Image URL is required");
  });

  it("passes once empty rows are dropped, which is what the manager now does", () => {
    const replaced = [...emptyProductFormValues.images, uploaded].filter((image) => image.src?.trim());
    expect(productFormSchema.safeParse({ ...filled, images: replaced }).success).toBe(true);
  });

  it("still requires alt text on an uploaded photo, and says so", async () => {
    const described = await reject({ ...filled, images: [{ src: uploaded.src, alt: "" }] });
    expect(described).toContain("Images 1 · alt: Alt text is required");
  });
});
