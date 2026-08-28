"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Heart, Share2 } from "lucide-react";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { getCommerceProvider } from "@/lib/commerce";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/types";

export function WishlistPageContent() {
  const t = useTranslations("Wishlist");
  const tCart = useTranslations("Cart");
  const { wishlist, isLoading, share } = useWishlist();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);

  const productIds = wishlist?.items.map((item) => item.productId) ?? [];
  const productIdsKey = productIds.join(",");

  useEffect(() => {
    if (productIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale products when the wishlist empties out
      setProducts([]);
      return;
    }
    getCommerceProvider().products.getByIds(productIds).then(setProducts);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- productIds is re-derived each render; productIdsKey keys the effect on its content
  }, [productIdsKey]);

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-luxe-gray-dark">Loading your wishlist...</p>;
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-32 text-center">
        <Heart className="size-12 text-luxe-gray-dark" strokeWidth={1} />
        <h1 className="font-heading text-2xl">{t("empty")}</h1>
        <p className="text-sm text-luxe-gray-dark">Save items you love to find them here later.</p>
        <Link
          href="/"
          className="mt-2 flex h-12 items-center justify-center bg-luxe-black px-8 text-xs font-medium tracking-[0.08em] text-luxe-white uppercase"
        >
          {tCart("continueShopping")}
        </Link>
      </div>
    );
  }

  const handleShare = async () => {
    try {
      const url = await share();
      await navigator.clipboard.writeText(url);
      toast({ title: t("linkCopied"), description: t("linkCopiedBody"), tone: "success" });
    } catch {
      toast({ title: t("shareLinkFailed"), tone: "error" });
    }
  };

  return (
    <div className="container-luxe py-10 md:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl">Your Wishlist ({products.length})</h1>
        <button
          type="button"
          onClick={handleShare}
          className="flex h-10 items-center gap-1.5 border border-border px-4 text-xs font-medium tracking-[0.05em] uppercase hover:border-luxe-black"
        >
          <Share2 className="size-3.5" strokeWidth={1.5} />
          {t("share")}
        </button>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
