"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Eye } from "lucide-react";
import { ColorSwatches } from "@/components/product/ColorSwatches";
import { QuickViewDialog } from "@/components/product/QuickViewDialog";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getEffectivePrice, getProductBadges, isOnSale } from "@/lib/product";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/blur-placeholder";
import { useWishlist } from "@/components/providers/WishlistProvider";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  className?: string;
}

const BADGE_STYLES: Record<string, string> = {
  sale: "bg-luxe-black text-luxe-white",
  new: "bg-luxe-white text-luxe-black",
  preorder: "bg-luxe-white text-luxe-black",
  backorder: "bg-luxe-white text-luxe-black",
  "low-stock": "bg-destructive text-luxe-white",
  bestseller: "bg-luxe-white text-luxe-black",
};

export function ProductCard({ product, className }: ProductCardProps) {
  const { isInWishlist, toggle } = useWishlist();
  const wishlisted = isInWishlist(product.id);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [primaryImage, hoverImage] = product.images;
  const badges = getProductBadges(product);
  const effectivePrice = getEffectivePrice(product);

  return (
    <div className={cn("group relative", className)}>
      <div className="relative aspect-3/4 overflow-hidden bg-luxe-gray-light">
        <Link href={`/products/${product.slug}`} aria-label={product.name} className="relative block size-full">
          <Image
            src={primaryImage.src}
            alt={primaryImage.alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            placeholder="blur"
            blurDataURL={SHIMMER_BLUR_DATA_URL}
            className={cn(
              "object-cover transition-opacity duration-500",
              hoverImage ? "group-hover:opacity-0" : ""
            )}
          />
          {hoverImage ? (
            <Image
              src={hoverImage.src}
              alt={hoverImage.alt}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              placeholder="blur"
              blurDataURL={SHIMMER_BLUR_DATA_URL}
              className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          ) : null}
        </Link>

        {badges.length > 0 ? (
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {badges.map((badge) => (
              <span
                key={badge.tone}
                className={cn(
                  "px-2 py-1 text-[10px] font-medium tracking-[0.08em] uppercase",
                  BADGE_STYLES[badge.tone]
                )}
              >
                {badge.label}
              </span>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={() => toggle(product.id)}
          className="absolute top-3 right-3 flex size-8 items-center justify-center bg-luxe-white/90 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Heart
            className={cn("size-4", wishlisted ? "fill-luxe-black" : "")}
            strokeWidth={1.5}
          />
        </button>

        <button
          type="button"
          onClick={() => setQuickViewOpen(true)}
          className="absolute inset-x-3 bottom-3 flex h-10 translate-y-2 items-center justify-center gap-2 bg-luxe-white text-xs font-medium tracking-[0.08em] text-luxe-black uppercase opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
        >
          <Eye className="size-4" strokeWidth={1.5} />
          Quick View
        </button>
      </div>

      <div className="mt-3">
        <Link href={`/products/${product.slug}`} className="block text-sm">
          {product.name}
        </Link>
        <div className="mt-1 flex items-center gap-2 text-sm">
          <span className={isOnSale(product) ? "text-destructive" : ""}>{formatMoney(effectivePrice)}</span>
          {isOnSale(product) && product.compareAtPrice ? (
            <span className="text-luxe-gray-dark line-through">{formatMoney(product.compareAtPrice)}</span>
          ) : null}
        </div>
        <ColorSwatches colors={product.colors} className="mt-2" />
      </div>

      <QuickViewDialog product={product} open={quickViewOpen} onOpenChange={setQuickViewOpen} />
    </div>
  );
}
