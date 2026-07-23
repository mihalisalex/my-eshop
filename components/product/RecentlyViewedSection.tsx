"use client";

import { useEffect, useState } from "react";
import { getCommerceProvider } from "@/lib/commerce";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/types";

interface RecentlyViewedSectionProps {
  currentProductId: string;
}

/** Records the current product as viewed, then shows the rest of the trail — this is inherently client/session state, not backend data. */
export function RecentlyViewedSection({ currentProductId }: RecentlyViewedSectionProps) {
  const { ids } = useRecentlyViewed(currentProductId);
  const [products, setProducts] = useState<Product[]>([]);

  const otherIds = ids.filter((id) => id !== currentProductId);
  const otherIdsKey = otherIds.join(",");

  // Fetches the product records for the trail (or clears it once there's nothing left
  // to show) whenever the id list changes — an unavoidable direct setState either way.
  useEffect(() => {
    if (!otherIdsKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProducts([]);
      return;
    }
    getCommerceProvider()
      .products.getByIds(otherIdsKey.split(","))
      .then(setProducts);
  }, [otherIdsKey]);

  if (products.length === 0) return null;

  return (
    <section className="border-t border-border py-10">
      <h2 className="font-heading text-2xl">Recently Viewed</h2>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
