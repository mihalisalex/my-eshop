import type { RawCsvRow } from "@/lib/products-import/csv";

/**
 * CSV v1 delimiter conventions — one row per product, flat columns with delimited
 * sub-fields for the repeating structures:
 *
 *   images            "https://…/a.jpg|Front view;;https://…/b.jpg|Back view"  (url|alt, ;;-separated)
 *   imageFilenames    "front.jpg|back.jpg"  (alternative to `images` — matched by filename
 *                      against files uploaded alongside the CSV, case-insensitive)
 *   colors            "Black#111111;;Ivory#F5F0EA"  (name#hex, ;;-separated)
 *   sizes             "S:true:12:SKU-S;;M:false:0"  (name:inStock:quantity:sku, sku optional, ;;-separated)
 *   tags/materials/careInstructions/collectionIds   "a|b|c"  (pipe-separated flat lists)
 *
 * Deliberately excluded from v1 (edit via the single-product form after import):
 * videos, per-color image overrides, SEO override, relatedProductIds.
 */
const LIST_SEP = "|";
const GROUP_SEP = ";;";

function splitList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value.split(LIST_SEP).map((s) => s.trim()).filter(Boolean);
}

function splitGroups(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value.split(GROUP_SEP).map((s) => s.trim()).filter(Boolean);
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return value.trim().toLowerCase() === "true";
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Unrecognized/blank values fall back to "active" rather than failing the row — see the
 * `status` note in mapCsvRowToProductForm. An invalid value is a typo, not a reason to
 * reject an otherwise-good product. */
function normalizeStatus(value: string | undefined): "draft" | "active" | "archived" {
  const normalized = value?.trim().toLowerCase();
  return normalized === "draft" || normalized === "archived" ? normalized : "active";
}

export interface MappedRow {
  /** A plain object shaped like ProductFormValues — not yet validated. Feed to productFormSchema.safeParse. */
  values: Record<string, unknown>;
  /** Mapping-time problems (e.g. an image filename with no matching upload) — distinct from schema validation errors. */
  errors: string[];
}

/** `resolvedImageUrls` maps a lowercased uploaded filename to its Vercel Blob URL. */
export function mapCsvRowToProductForm(row: RawCsvRow, resolvedImageUrls: Map<string, string>): MappedRow {
  const errors: string[] = [];

  let images: { src: string; alt: string }[] = [];
  if (row.images?.trim()) {
    images = splitGroups(row.images).map((entry) => {
      const [src, alt] = entry.split(LIST_SEP);
      const trimmedSrc = (src ?? "").trim();
      return { src: trimmedSrc, alt: (alt ?? "").trim() || row.name?.trim() || trimmedSrc };
    });
  } else if (row.imageFilenames?.trim()) {
    for (const filename of splitList(row.imageFilenames)) {
      const url = resolvedImageUrls.get(filename.toLowerCase());
      if (!url) {
        errors.push(`Image file "${filename}" was listed but not found among the uploaded files.`);
        continue;
      }
      images.push({ src: url, alt: row.name?.trim() || filename });
    }
  }

  const colors = splitGroups(row.colors).map((entry) => {
    const [name, hex] = entry.split("#");
    return { name: (name ?? "").trim(), hex: hex ? `#${hex.trim()}` : "" };
  });

  const sizes = splitGroups(row.sizes).map((entry) => {
    const [name, inStock, quantity, sku] = entry.split(":");
    return {
      name: (name ?? "").trim(),
      inStock: (inStock ?? "true").trim().toLowerCase() !== "false",
      quantity: parseNumber(quantity) ?? 0,
      sku: sku?.trim() || undefined,
    };
  });

  const values: Record<string, unknown> = {
    slug: row.slug?.trim() ?? "",
    name: row.name?.trim() ?? "",
    description: row.description?.trim() ?? "",
    price: parseNumber(row.price),
    compareAtPrice: parseNumber(row.compareAtPrice),
    salePrice: parseNumber(row.salePrice),
    costPrice: parseNumber(row.costPrice),
    currencyCode: row.currencyCode?.trim() || "EUR",
    images,
    colors,
    sizes,
    category: row.category?.trim() ?? "",
    collectionIds: splitList(row.collectionIds),
    tags: splitList(row.tags),
    gender: row.gender?.trim() || "unisex",
    season: row.season?.trim() || undefined,
    materials: splitList(row.materials),
    careInstructions: splitList(row.careInstructions),
    relatedProductIds: [],
    isNew: parseBool(row.isNew, false),
    isSale: parseBool(row.isSale, false),
    isPreorder: parseBool(row.isPreorder, false),
    isBackorder: parseBool(row.isBackorder, false),
    fulfillmentNote: row.fulfillmentNote?.trim() || undefined,
    sku: row.sku?.trim() ?? "",
    barcode: row.barcode?.trim() || undefined,
    inventoryPolicy: row.inventoryPolicy?.trim() || "deny",
    shippingWeightGrams: parseNumber(row.shippingWeightGrams),
    availableForSale: parseBool(row.availableForSale, true),
    // Imports default to "active" (not "draft" like the manual form): a bulk import is an
    // explicit act of publishing a prepared catalog, and defaulting hundreds of rows to
    // draft would mean hand-publishing every one. An explicit `status` column still wins.
    brand: row.brand?.trim() || undefined,
    vendor: row.vendor?.trim() || undefined,
    status: normalizeStatus(row.status),
  };

  return { values, errors };
}
