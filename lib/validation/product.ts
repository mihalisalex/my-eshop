import { z } from "zod";
import type { Product } from "@/types/product";

/**
 * Shared source of truth for the Product shape: used to validate the Json
 * columns (images/videos/seo) on every DB read and write (Postgres doesn't
 * enforce their structure), and reused by the admin create/edit form via
 * zodResolver so client validation and server validation can't drift apart.
 */

export const imageSchema = z.object({
  src: z.string().min(1, "Image URL is required"),
  alt: z.string().min(1, "Alt text is required"),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  blurDataURL: z.string().optional(),
});

export const productVideoSchema = z.object({
  src: z.string().min(1),
  poster: z.string().min(1),
  alt: z.string().min(1),
});

/**
 * Per-entity SEO overrides. Every field is optional and every one of them means "the admin
 * disagreed with the generated default" — see lib/seo/resolve.ts, which owns the defaults.
 *
 * Stored in a Json column, so adding fields here needs no migration. Adding OPTIONAL fields
 * is also safe for rows already written; tightening anything is not (see NOTES.md).
 */
export const productSeoOverrideSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  ogImage: z.string().optional(),
  /**
   * Absolute URL. An escape hatch, not a routine field: the resolver already emits a
   * correct self-referencing canonical for every page, and the common reasons to override
   * one (a renamed slug, a duplicate) are handled properly by slug history and by the
   * facet strategy instead. Validated as a real URL so a typo cannot de-index a page.
   */
  canonicalUrl: z.string().url("Canonical must be a full URL including https://").optional(),
  /**
   * Holds the page out of search results. Also excludes it from the sitemap — listing a
   * noindex URL in a sitemap asks for two opposite things at once.
   */
  noIndex: z.boolean().optional(),
  /** Falls back to the SEO title, which falls back to the entity's name. */
  ogTitle: z.string().optional(),
  /** Falls back to the meta description. */
  ogDescription: z.string().optional(),
});

export type ProductSeoOverride = z.infer<typeof productSeoOverrideSchema>;

export const seoFaqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

/**
 * Categories carry everything a product does, plus the editorial fields that turn a grid of
 * products into a page worth ranking. Products do not get these: a product page's content
 * is its description, and a second free-text block below the grid is a place for filler to
 * accumulate.
 */
export const categorySeoOverrideSchema = productSeoOverrideSchema.extend({
  /** Shown above the product grid. Real copy about the category, not keyword filler. */
  introContent: z.string().optional(),
  /** Rendered on the page AND as FAQPage structured data — never one without the other. */
  faqs: z.array(seoFaqSchema).optional(),
});

export type CategorySeoOverride = z.infer<typeof categorySeoOverrideSchema>;

/**
 * Collapses a SEO override to `undefined` when every field is blank, and drops
 * individual blank fields.
 *
 * This exists because of the same react-hook-form trap already documented for
 * categories: registering `seo.title`/`seo.description` makes RHF materialise the
 * PARENT as `{ title: "", description: "" }` rather than leaving it undefined, so a
 * product saved with the optional SEO block untouched stored empty strings. Every
 * consumer then read them with `product.seo?.title ?? product.name` — and `??` only
 * falls back on null/undefined, never on "". The result was a product page whose
 * `<title>` rendered as " | Alexandris Stores" with no meta description, appearing
 * one product at a time as the catalog got edited, with nothing in the UI to
 * indicate it had happened.
 *
 * Normalising at the write boundary is what stops new rows being created that way;
 * the read-side fallbacks were made truthiness-based in the same change so rows
 * already written like this render correctly too.
 */
export function normalizeSeoOverride(
  seo: CategorySeoOverride | null | undefined
): CategorySeoOverride | undefined {
  if (!seo) return undefined;
  const cleaned: CategorySeoOverride = {};
  if (seo.title?.trim()) cleaned.title = seo.title.trim();
  if (seo.description?.trim()) cleaned.description = seo.description.trim();
  if (seo.ogImage?.trim()) cleaned.ogImage = seo.ogImage.trim();
  if (seo.canonicalUrl?.trim()) cleaned.canonicalUrl = seo.canonicalUrl.trim();
  if (seo.ogTitle?.trim()) cleaned.ogTitle = seo.ogTitle.trim();
  if (seo.ogDescription?.trim()) cleaned.ogDescription = seo.ogDescription.trim();
  if (seo.introContent?.trim()) cleaned.introContent = seo.introContent.trim();
  // Only `true` is worth storing. `false` is the default, and persisting it would make
  // every product carry an explicit "please index me" that reads like a decision.
  if (seo.noIndex === true) cleaned.noIndex = true;
  // A FAQ needs both halves to be worth anything — half-filled rows are dropped rather
  // than stored, because they would reach FAQPage structured data as empty strings.
  const faqs = seo.faqs?.filter((faq) => faq.question.trim() && faq.answer.trim());
  if (faqs?.length) cleaned.faqs = faqs.map((faq) => ({ question: faq.question.trim(), answer: faq.answer.trim() }));
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export const colorVariantSchema = z.object({
  name: z.string().min(1),
  hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color, e.g. #111111"),
  imageSrc: z.string().optional(),
  imageAlt: z.string().optional(),
});

export const sizeVariantSchema = z.object({
  name: z.string().min(1, "Size is required"),
  inStock: z.boolean(),
  quantity: z.number().int().min(0),
  /**
   * The stock this size held when the form was LOADED — not a value anyone types.
   *
   * Present, `quantity` is applied as a delta (`current + (submitted - baseline)`);
   * absent, it is applied absolutely. That difference is the whole point: the admin form
   * round-trips a number the shop has since moved on from, so writing it back absolutely
   * silently resurrects sold stock. Open a product at quantity 3, sell one, save — and the
   * shelf goes back to 3 with nothing recording that it happened.
   *
   * Absent on purpose for the two callers where the submitted number really is
   * authoritative: a newly added size (nothing to be stale about) and CSV import, whose
   * entire job is to state what the stock now is.
   */
  quantityBaseline: z.number().int().min(0).optional(),
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
export const productStatusSchema = z.enum(["draft", "active", "archived"]);

const slugSchema = z
  .string()
  .min(1, "URL slug is required")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only");

export const productFormSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  price: z.number().positive("Price must be greater than 0"),
  compareAtPrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional(),
  /** Allows 0 (genuinely free stock — samples, gifts) where price/salePrice require positive. */
  costPrice: z.number().min(0).optional(),
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
  status: productStatusSchema,
  brand: z.string().optional(),
  vendor: z.string().optional(),
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
    costPrice: product.costPrice?.amount,
    currencyCode: product.price.currencyCode,
    images: product.images,
    videos: product.videos,
    colors: product.colors.map((color) => ({
      name: color.name,
      hex: color.hex,
      imageSrc: color.image?.src,
      imageAlt: color.image?.alt,
    })),
    // The baseline is stamped here, at the one place a stored product becomes an editable
    // form, so every edit carries the stock it started from. See sizeVariantSchema.
    sizes: product.sizes.map((size) => ({ ...size, quantityBaseline: size.quantity })),
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
    status: product.status,
    brand: product.brand,
    vendor: product.vendor,
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
  // New products start as drafts so a half-finished entry can't appear on the storefront
  // the moment it's saved — publishing is a deliberate step.
  status: "draft",
};
