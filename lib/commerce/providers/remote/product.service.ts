import type { Product } from "@/types";
import type { ProductQueryParams, ProductService } from "@/lib/commerce/types";

/**
 * Browser-side ProductService: fetches over HTTP instead of importing the
 * Prisma-backed data layer directly (which cannot run in the browser at all).
 * Used only when constructing the commerce provider for client components
 * (CartProvider, WishlistProvider, SearchOverlay, ProductListingPage).
 */
async function fetchProducts(params: URLSearchParams): Promise<Product[]> {
  const response = await fetch(`/api/products?${params.toString()}`);
  if (!response.ok) throw new Error(`Failed to fetch products (${response.status})`);
  const data = (await response.json()) as { products: Product[] };
  return data.products;
}

export function createRemoteProductService(): ProductService {
  return {
    async getAll(params?: ProductQueryParams): Promise<Product[]> {
      const query = new URLSearchParams();
      if (params?.category) query.set("category", params.category);
      if (params?.gender) query.set("gender", params.gender);
      if (params?.collectionId) query.set("collectionId", params.collectionId);
      if (params?.tag) query.set("tag", params.tag);
      return fetchProducts(query);
    },

    async getBySlug(slug: string): Promise<Product | null> {
      const [product] = await fetchProducts(new URLSearchParams({ slug }));
      return product ?? null;
    },

    async getById(id: string): Promise<Product | null> {
      const [product] = await fetchProducts(new URLSearchParams({ ids: id }));
      return product ?? null;
    },

    async getByIds(ids: string[]): Promise<Product[]> {
      if (ids.length === 0) return [];
      return fetchProducts(new URLSearchParams({ ids: ids.join(",") }));
    },

    async getRelated(productId: string, limit = 4): Promise<Product[]> {
      return fetchProducts(new URLSearchParams({ relatedTo: productId, limit: String(limit) }));
    },
  };
}
