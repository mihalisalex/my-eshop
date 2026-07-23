import { z } from "zod";
import type { Product } from "@/types/product";

/**
 * Shared source of truth for the Product shape: used to validate the Json
 * columns (images/videos/seo) on every DB read and write (Postgres doesn't
 * enforce their structure), and reused by the admin create/edit form via
 * zodResolver so client validation and server validation can't drift apart.
 */

export const imageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  blurDataURL: z.string().optional(),
});

export const productVideoSchema = z.object({
  src: z.string().min(1),
  poster: z.string().min(1),
  alt: z.string().min(1),
});

export const productSeoOverrideSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  ogImage: z.string().optional(),
});

export const colorVariantSchema = z.object({
  name: z.string().min(1),
  hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color, e.g. #111111"),
  imageSrc: z.string().optional(),
  imageAlt: z.string().optional(),
});

export const sizeVariantSchema = z.object({
  name: z.string().min(1),
  inStock: z.boolean(),
  quantity: z.number().int().min(0),
  sku: z.string().optional(),
  barcode: z.string().optional(),
});

export const productGenderSchema = z.enum(["women", "men", "unisex", "kids"]);
export const productSeasonSchema = z.enum([
  "spring-summer",
  "autumn-winter",
  "resort",
  "all-season",
]);
export const inventoryPolicySchema = z.enum(["deny", "continue"]);

const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only");

export const productFormSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  price: z.number().positive("Price must be greater than 0"),
  compareAtPrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional(),
  currencyCode: z.string().length(3),
  images: z.array(imageSchema).min(1, "At least one image is required"),
  videos: z.array(productVideoSchema).optional(),
  colors: z.array(colorVariantSchema),
  sizes: z.array(sizeVariantSchema).min(1, "At least one size is required"),
  category: z.string().min(1, "Category is required"),
  collectionIds: z.array(z.string()),
  tags: z.array(z.string()),
  gender: productGenderSchema,
  season: productSeasonSchema.optional(),
  materials: z.array(z.string()),
  careInstructions: z.array(z.string()),
  relatedProductIds: z.array(z.string()),
  isNew: z.boolean(),
  isSale: z.boolean(),
  isPreorder: z.boolean(),
  isBackorder: z.boolean(),
  fulfillmentNote: z.string().optional(),
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().optional(),
  inventoryPolicy: inventoryPolicySchema,
  shippingWeightGrams: z.number().int().positive().optional(),
  availableForSale: z.boolean(),
  seo: productSeoOverrideSchema.optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const productImagesSchema = z.array(imageSchema).min(1, "At least one image is required");
export const productVideosSchema = z.array(productVideoSchema);

export function productToFormValues(product: Product): ProductFormValues {
  return {
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: product.price.amount,
    compareAtPrice: product.compareAtPrice?.amount,
    salePrice: product.salePrice?.amount,
    currencyCode: product.price.currencyCode,
    images: product.images,
    videos: product.videos,
    colors: product.colors.map((color) => ({
      name: color.name,
      hex: color.hex,
      imageSrc: color.image?.src,
      imageAlt: color.image?.alt,
    })),
    sizes: product.sizes,
    category: product.category,
    collectionIds: product.collectionIds,
    tags: product.tags,
    gender: product.gender,
    season: product.season,
    materials: product.materials,
    careInstructions: product.careInstructions,
    relatedProductIds: product.relatedProductIds ?? [],
    isNew: product.isNew ?? false,
    isSale: product.isSale ?? false,
    isPreorder: product.isPreorder ?? false,
    isBackorder: product.isBackorder ?? false,
    fulfillmentNote: product.fulfillmentNote,
    sku: product.sku,
    barcode: product.barcode,
    inventoryPolicy: product.inventoryPolicy,
    shippingWeightGrams: product.shippingWeightGrams,
    availableForSale: product.availableForSale,
    seo: product.seo,
  };
}

export const emptyProductFormValues: ProductFormValues = {
  slug: "",
  name: "",
  description: "",
  price: 0,
  currencyCode: "EUR",
  images: [{ src: "", alt: "" }],
  colors: [],
  sizes: [{ name: "", inStock: true, quantity: 0 }],
  category: "",
  collectionIds: [],
  tags: [],
  gender: "unisex",
  materials: [],
  careInstructions: [],
  relatedProductIds: [],
  isNew: false,
  isSale: false,
  isPreorder: false,
  isBackorder: false,
  sku: "",
  inventoryPolicy: "deny",
  availableForSale: true,
};
