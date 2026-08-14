import { z } from "zod";
import { productSeoOverrideSchema } from "@/lib/validation/product";
import type { Category } from "@/types/category";

const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only");

/**
 * Deliberately more lenient than `imageSchema` (whose `src`/`alt` both require `min(1)`):
 * CategoryForm registers `image.src`/`image.alt` as individual nested fields, and
 * react-hook-form default-initializes an unset nested path to `{ src: "", alt: "" }`
 * rather than leaving the parent `undefined`. Reusing the strict schema here made every
 * "image left blank, as intended" submission fail validation with no rendered error (the
 * fields never showed one) — a silent dead submit button. `superRefine` still requires alt
 * text once a URL is actually provided; the empty-object case is genuinely valid here, not
 * an error to report. "Empty src → no image at all" is a write-time concern, handled where
 * the row is actually built (app/admin/(dashboard)/categories/actions.ts), not here.
 */
const optionalImageFormSchema = z
  .object({
    src: z.string().optional(),
    alt: z.string().optional(),
  })
  .optional()
  .superRefine((image, ctx) => {
    if (image?.src && !image.alt) {
      ctx.addIssue({ code: "custom", message: "Alt text is required once an image URL is set.", path: ["alt"] });
    }
  });

export const categoryFormSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1, "Name is required"),
  nameEl: z.string().optional(),
  description: z.string().optional(),
  descriptionEl: z.string().optional(),
  /** Empty string means "top-level" — a plain `<select>` can't natively represent
   * `undefined`, so the form works in `""` and the action layer normalizes it to `null`. */
  parentId: z.string().optional(),
  image: optionalImageFormSchema,
  bannerImage: optionalImageFormSchema,
  isFeatured: z.boolean(),
  isVisible: z.boolean(),
  seo: productSeoOverrideSchema.optional(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function categoryToFormValues(category: Category): CategoryFormValues {
  return {
    slug: category.slug,
    name: category.name,
    nameEl: category.nameEl,
    description: category.description,
    descriptionEl: category.descriptionEl,
    parentId: category.parentId ?? "",
    image: category.image,
    bannerImage: category.bannerImage,
    isFeatured: category.isFeatured,
    isVisible: category.isVisible,
    seo: category.seo,
  };
}

export const emptyCategoryFormValues: CategoryFormValues = {
  slug: "",
  name: "",
  parentId: "",
  isFeatured: false,
  isVisible: true,
};
