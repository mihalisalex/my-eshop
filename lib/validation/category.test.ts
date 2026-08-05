import { describe, expect, it } from "vitest";
import { categoryFormSchema, emptyCategoryFormValues } from "@/lib/validation/category";

describe("categoryFormSchema", () => {
  it("validates a fully blank image/bannerImage — react-hook-form's actual default shape for an unset nested field, not undefined", () => {
    // This is the exact bug: registering `image.src`/`image.alt` as nested fields makes
    // react-hook-form default the parent to `{ src: "", alt: "" }`, never `undefined`.
    // Reusing the strict Image schema (src/alt both required) here made every "left blank,
    // as intended" submission fail with no rendered error — a silently dead submit button.
    const result = categoryFormSchema.safeParse({
      ...emptyCategoryFormValues,
      name: "Sneakers",
      slug: "sneakers",
      image: { src: "", alt: "" },
      bannerImage: { src: "", alt: "" },
    });
    expect(result.success).toBe(true);
  });

  it("requires alt text once an image URL is actually provided", () => {
    const result = categoryFormSchema.safeParse({
      ...emptyCategoryFormValues,
      name: "Sneakers",
      slug: "sneakers",
      image: { src: "https://example.com/a.jpg", alt: "" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a fully-specified image", () => {
    const result = categoryFormSchema.safeParse({
      ...emptyCategoryFormValues,
      name: "Sneakers",
      slug: "sneakers",
      image: { src: "https://example.com/a.jpg", alt: "Sneakers" },
    });
    expect(result.success).toBe(true);
  });

  it("still requires name and slug", () => {
    const result = categoryFormSchema.safeParse({ ...emptyCategoryFormValues, name: "", slug: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a slug with spaces or uppercase", () => {
    const result = categoryFormSchema.safeParse({ ...emptyCategoryFormValues, name: "Sneakers", slug: "Running Shoes" });
    expect(result.success).toBe(false);
  });
});
