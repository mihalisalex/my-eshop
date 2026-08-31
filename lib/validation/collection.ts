import { z } from "zod";
import { categorySeoOverrideSchema, imageSchema } from "@/lib/validation/product";
import type { Collection } from "@/types/collection";

const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only");

export const ctaVariantSchema = z.enum(["primary", "secondary", "ghost", "link"]);

export const collectionFormSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  image: imageSchema,
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
  ctaVariant: ctaVariantSchema.optional(),
  productIds: z.array(z.string()),
  /** Same overrides a category carries — collections are landing pages too. */
  seo: categorySeoOverrideSchema.optional(),
});

export type CollectionFormValues = z.infer<typeof collectionFormSchema>;

export function collectionToFormValues(collection: Collection): CollectionFormValues {
  return {
    slug: collection.slug,
    title: collection.title,
    subtitle: collection.subtitle,
    description: collection.description,
    image: collection.image,
    ctaLabel: collection.cta?.label,
    ctaHref: collection.cta?.href,
    ctaVariant: collection.cta?.variant,
    productIds: collection.productIds ?? [],
    seo: collection.seo,
  };
}

export const emptyCollectionFormValues: CollectionFormValues = {
  slug: "",
  title: "",
  image: { src: "", alt: "" },
  productIds: [],
};
