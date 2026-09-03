/**
 * Turning a react-hook-form error tree into something a person can act on.
 *
 * `handleSubmit` refuses to run the submit handler while validation fails, and RHF responds
 * by focusing the first offending input. That works only for fields that are on screen. A
 * field which is registered but not rendered — a hidden row, a collapsed panel, an array
 * entry the UI filters out — fails invisibly, and the save button looks broken.
 *
 * That is not hypothetical: a new product started with one blank image row, the gallery hid
 * it because there was no thumbnail to draw, and "Create product" did nothing at all while
 * `images.0.src` was rejected on every press.
 */

/** Section names, so a message points at where on the page the field actually lives. */
export const PRODUCT_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  slug: "URL slug",
  description: "Description",
  price: "Price",
  salePrice: "Sale price",
  compareAtPrice: "Compare-at price",
  costPrice: "Cost price",
  sku: "SKU",
  barcode: "Barcode",
  category: "Category",
  images: "Images",
  videos: "Videos",
  sizes: "Sizes",
  colors: "Colours",
  seo: "SEO",
  currencyCode: "Currency",
  shippingWeightGrams: "Shipping weight",
};

/**
 * Every rejected field, as "Label detail: message" lines.
 *
 * Walks the tree rather than reading known keys, so a field added to the schema later is
 * reported without anyone remembering to list it here — the whole point being that no
 * rejection is allowed to stay silent.
 */
export function describeFormErrors(
  node: unknown,
  labels: Record<string, string> = PRODUCT_FIELD_LABELS,
  path: string[] = []
): string[] {
  if (!node || typeof node !== "object") return [];

  const record = node as Record<string, unknown>;
  if (typeof record.message === "string" && record.message) {
    const [head, ...rest] = path;
    const label = labels[head] ?? head;
    // "images.1.alt" reads as "Images 2 · alt" — a merchandiser counts photos from one and
    // does not think in field paths.
    const detail = rest.map((part) => (/^\d+$/.test(part) ? String(Number(part) + 1) : part)).join(" · ");
    return [`${[label, detail].filter(Boolean).join(" ")}: ${record.message}`];
  }

  /**
   * `ref` holds a DOM node — walking into it would recurse through the whole document — and
   * `type` names the rule that failed rather than describing anything.
   */
  return Object.entries(record)
    .filter(([key]) => key !== "ref" && key !== "type")
    .flatMap(([key, value]) => describeFormErrors(value, labels, [...path, key]));
}
