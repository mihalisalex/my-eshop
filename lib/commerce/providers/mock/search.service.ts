import { getEffectivePrice } from "@/lib/product";
import type { Product } from "@/types";
import type { ProductService, SearchFacet, SearchOptions, SearchResult, SearchService } from "@/lib/commerce/types";

function matches(product: Product, query: string): boolean {
  const haystack = [
    product.name,
    product.description,
    product.category,
    product.tags.join(" "),
    product.materials.join(" "),
    product.sku,
    product.colors.map((color) => color.name).join(" "),
    product.sizes.map((size) => size.name).join(" "),
    product.sizes.map((size) => size.sku).filter(Boolean).join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function isAvailable(product: Product): boolean {
  return product.availableForSale && product.sizes.some((size) => size.inStock && size.quantity > 0);
}

function buildFacets(products: Product[]): SearchFacet[] {
  const categoryCounts = new Map<string, number>();
  const genderCounts = new Map<string, number>();
  const colorCounts = new Map<string, number>();
  const sizeCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  for (const product of products) {
    categoryCounts.set(product.category, (categoryCounts.get(product.category) ?? 0) + 1);
    genderCounts.set(product.gender, (genderCounts.get(product.gender) ?? 0) + 1);
    for (const color of product.colors) colorCounts.set(color.name, (colorCounts.get(color.name) ?? 0) + 1);
    for (const size of product.sizes) sizeCounts.set(size.name, (sizeCounts.get(size.name) ?? 0) + 1);
    for (const tag of product.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  const toValues = (counts: Map<string, number>) => Array.from(counts.entries()).map(([value, count]) => ({ value, count }));

  return [
    { key: "category", label: "Category", values: toValues(categoryCounts) },
    { key: "gender", label: "Gender", values: toValues(genderCounts) },
    { key: "color", label: "Color", values: toValues(colorCounts) },
    { key: "size", label: "Size", values: toValues(sizeCounts) },
    { key: "tag", label: "Tags", values: toValues(tagCounts) },
  ];
}

/** In-memory substring search over the mock catalog. A real adapter swaps this for Algolia/Elasticsearch/platform search. */
export function createMockSearchService(productService: ProductService): SearchService {
  return {
    async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
      const normalized = query.trim().toLowerCase();

      // Scope filters narrow which section of the catalog we're browsing (category page,
      // gender page, a collection, new-in, sale) — pushed into the query itself so a
      // category/gender page only ever pulls its own slice of the catalog instead of
      // fetching every product in the store on every search. Facets are built from this
      // scoped set so counts reflect "what's available here," not the user's already-
      // applied refinements.
      // Unisex items (accessories) are shoppable from both gendered sections, not just a
      // literal gender match — otherwise browsing /women or /men never surfaces accessories.
      const scoped0 = await productService.getAll({
        category: options.category,
        gender: options.gender,
        includeUnisex: Boolean(options.gender),
        collectionId: options.collectionId,
        isNew: options.isNew,
        isSale: options.isSale,
      });
      const scoped = normalized ? scoped0.filter((p) => matches(p, normalized)) : scoped0;

      const facets = buildFacets(scoped);

      // Refinement filters — the user's adjustable facet selections.
      let results = scoped;
      if (options.colors?.length) {
        results = results.filter((p) => p.colors.some((c) => options.colors!.includes(c.name)));
      }
      if (options.sizes?.length) {
        results = results.filter((p) => p.sizes.some((s) => options.sizes!.includes(s.name)));
      }
      if (options.tags?.length) {
        results = results.filter((p) => p.tags.some((t) => options.tags!.includes(t)));
      }
      if (options.availability === "in-stock") {
        results = results.filter((p) => isAvailable(p));
      }
      if (typeof options.minPrice === "number") {
        results = results.filter((p) => getEffectivePrice(p).amount >= options.minPrice!);
      }
      if (typeof options.maxPrice === "number") {
        results = results.filter((p) => getEffectivePrice(p).amount <= options.maxPrice!);
      }

      switch (options.sort) {
        case "price-asc":
          results = [...results].sort((a, b) => getEffectivePrice(a).amount - getEffectivePrice(b).amount);
          break;
        case "price-desc":
          results = [...results].sort((a, b) => getEffectivePrice(b).amount - getEffectivePrice(a).amount);
          break;
        case "newest":
          results = [...results].sort((a, b) => Number(b.isNew) - Number(a.isNew));
          break;
        default:
          break;
      }

      const total = results.length;
      const page = options.page ?? 1;

      if (options.pageSize) {
        const start = (page - 1) * options.pageSize;
        results = results.slice(start, start + options.pageSize);
      } else if (options.limit) {
        results = results.slice(0, options.limit);
      }

      return { query, products: results, total, facets, page, pageSize: options.pageSize ?? total };
    },

    async getSuggestions(query: string, limit = 5): Promise<string[]> {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return [];
      const all = await productService.getAll();
      const names = all.filter((p) => matches(p, normalized)).map((p) => p.name);
      return Array.from(new Set(names)).slice(0, limit);
    },
  };
}
