import type { Collection, Product } from "@/types";
import type { CollectionService } from "@/lib/commerce/types";
import { createRemoteProductService } from "@/lib/commerce/providers/remote/product.service";

async function fetchCollections(params: URLSearchParams): Promise<Collection[]> {
  const response = await fetch(`/api/collections?${params.toString()}`);
  if (!response.ok) throw new Error(`Failed to fetch collections (${response.status})`);
  const data = (await response.json()) as { collections: Collection[] };
  return data.collections;
}

export function createRemoteCollectionService(): CollectionService {
  const products = createRemoteProductService();

  return {
    async getAll(): Promise<Collection[]> {
      return fetchCollections(new URLSearchParams());
    },

    async getBySlug(slug: string): Promise<Collection | null> {
      const [collection] = await fetchCollections(new URLSearchParams({ slug }));
      return collection ?? null;
    },

    async getProducts(collectionId: string): Promise<Product[]> {
      const [collection] = await fetchCollections(new URLSearchParams({ ids: collectionId }));
      if (!collection?.productIds) return [];
      return products.getByIds(collection.productIds);
    },
  };
}
