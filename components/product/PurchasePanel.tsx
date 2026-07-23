"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Flame, Heart, Minus, Plus, Ruler, Truck } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  findSizeVariant,
  getEffectivePrice,
  getProductBadges,
  getRecentPurchaseCount,
  isOnSale,
} from "@/lib/product";
import { getDeliveryEstimate } from "@/lib/delivery";
import { suggestSize } from "@/lib/fit-recommendation";
import { VariantSelector } from "@/components/product/VariantSelector";
import { SizeGuideDialog } from "@/components/product/SizeGuideDialog";
import { useCart } from "@/components/providers/CartProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { getCommerceProvider } from "@/lib/commerce";
import type { Product } from "@/types";

interface PurchasePanelProps {
  product: Product;
}

const BADGE_STYLES: Record<string, string> = {
  sale: "bg-luxe-black text-luxe-white",
  new: "bg-luxe-gray-light text-luxe-black",
  preorder: "bg-luxe-gray-light text-luxe-black",
  backorder: "bg-luxe-gray-light text-luxe-black",
  "low-stock": "bg-destructive text-luxe-white",
  bestseller: "bg-luxe-gray-light text-luxe-black",
};

export function PurchasePanel({ product }: PurchasePanelProps) {
  const t = useTranslations("Pdp");
  const { addItem, isMutating } = useCart();
  const { isInWishlist, toggle } = useWishlist();
  const { customer } = useAuth();
  const [selectedColor, setSelectedColor] = useState(product.colors[0]?.name ?? "");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [sizeSuggestion, setSizeSuggestion] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;
    const commerce = getCommerceProvider();
    commerce.customer.getOrders(customer.id).then(async (orders) => {
      const productIds = [...new Set(orders.flatMap((order) => order.lineItems.map((item) => item.productId)))];
      if (productIds.length === 0) return;
      const products = await commerce.products.getByIds(productIds);
      const byId = new Map(products.map((p) => [p.id, p]));
      const suggestion = suggestSize(orders, byId, product);
      setSizeSuggestion(suggestion);
    });
  }, [customer, product]);

  const badges = getProductBadges(product);
  const effectivePrice = getEffectivePrice(product);
  const wishlisted = isInWishlist(product.id);
  const sizeVariant = selectedSize ? findSizeVariant(product, selectedSize) : undefined;
  const maxQuantity = sizeVariant ? (sizeVariant.quantity > 0 ? sizeVariant.quantity : 99) : 10;
  const recentPurchaseCount = getRecentPurchaseCount(product);

  const canAdd = product.availableForSale && Boolean(selectedSize) && !isMutating;

  return (
    <div className="flex flex-col">
      <p className="text-eyebrow">{product.category}</p>
      <h1 className="font-heading mt-2 text-3xl md:text-4xl">{product.name}</h1>

      {badges.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <span
              key={badge.tone}
              className={cn("px-2 py-1 text-[10px] font-medium tracking-[0.08em] uppercase", BADGE_STYLES[badge.tone])}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-xl">
        {formatMoney(effectivePrice)}
        {isOnSale(product) && product.compareAtPrice ? (
          <span className="ml-2 text-sm text-luxe-gray-dark line-through">{formatMoney(product.compareAtPrice)}</span>
        ) : null}
      </p>

      <p className="mt-4 text-sm text-luxe-gray-dark">{product.description}</p>

      {(product.isPreorder || product.isBackorder) && product.fulfillmentNote ? (
        <p className="mt-4 border border-border bg-luxe-gray-light px-4 py-3 text-sm">{product.fulfillmentNote}</p>
      ) : null}

      <div className="mt-6">
        <VariantSelector
          product={product}
          selectedColor={selectedColor}
          selectedSize={selectedSize}
          onSelectColor={setSelectedColor}
          onSelectSize={setSelectedSize}
          onOpenSizeGuide={() => setSizeGuideOpen(true)}
        />
        {sizeSuggestion && !selectedSize ? (
          <button
            type="button"
            onClick={() => setSelectedSize(sizeSuggestion)}
            className="mt-3 flex items-center gap-1.5 text-xs text-luxe-gray-dark hover:text-luxe-black"
          >
            <Ruler className="size-3.5" strokeWidth={1.5} />
            {t("sizeSuggestion", { size: sizeSuggestion })}
          </button>
        ) : null}
      </div>

      <div className="mt-6">
        <p className="text-eyebrow mb-2">{t("quantity")}</p>
        <div className="flex w-fit items-center border border-border">
          <button
            type="button"
            aria-label={t("decreaseQuantity")}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="flex size-11 items-center justify-center disabled:opacity-40"
            disabled={quantity <= 1}
          >
            <Minus className="size-3.5" strokeWidth={1.5} />
          </button>
          <span className="w-10 text-center text-sm">{quantity}</span>
          <button
            type="button"
            aria-label={t("increaseQuantity")}
            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
            className="flex size-11 items-center justify-center disabled:opacity-40"
            disabled={quantity >= maxQuantity}
          >
            <Plus className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => selectedSize && addItem({ productId: product.id, color: selectedColor, size: selectedSize, quantity })}
          className="flex h-13 flex-1 items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {!selectedSize ? t("selectSize") : !product.availableForSale ? t("unavailable") : product.isPreorder ? t("preorder") : t("addToBag")}
        </button>
        <button
          type="button"
          aria-label={wishlisted ? t("removeFromWishlist") : t("addToWishlist")}
          onClick={() => toggle(product.id)}
          className="flex size-13 shrink-0 items-center justify-center border border-border transition-colors hover:border-luxe-black"
        >
          <Heart className={cn("size-5", wishlisted ? "fill-luxe-black" : "")} strokeWidth={1.5} />
        </button>
      </div>

      {recentPurchaseCount > 0 ? (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-luxe-gray-dark">
          <Flame className="size-3.5" strokeWidth={1.5} />
          {recentPurchaseCount} people bought this in the last 48 hours
        </p>
      ) : null}

      <div className="mt-6 flex items-start gap-2 border-t border-border pt-4 text-sm text-luxe-gray-dark">
        <Truck className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
        <span>
          Free standard shipping over €150 · Arrives <span className="text-luxe-black">{getDeliveryEstimate(3, 5)}</span>
        </span>
      </div>

      <SizeGuideDialog open={sizeGuideOpen} onOpenChange={setSizeGuideOpen} />
    </div>
  );
}
