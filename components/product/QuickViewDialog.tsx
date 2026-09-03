"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getEffectivePrice, getListPrice, isOnSale, isSizePurchasable } from "@/lib/product";
import { useCart } from "@/components/providers/CartProvider";
import { useCategoryName } from "@/components/providers/CategoryNamesProvider";
import type { Product } from "@/types";

interface QuickViewDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickViewDialog({ product, open, onOpenChange }: QuickViewDialogProps) {
  const t = useTranslations("Pdp");
  const { addItem, isMutating } = useCart();
  const [selectedColor, setSelectedColor] = useState(product.colors[0]?.name ?? "");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const categoryName = useCategoryName(product.category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 rounded-none border-none p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="relative aspect-3/4 bg-luxe-gray-light">
            <Image
              src={product.images[0].src}
              alt={product.images[0].alt}
              fill
              sizes="(min-width: 768px) 384px, 100vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col p-8">
            <p className="text-eyebrow">{categoryName}</p>
            <h2 className="font-heading mt-2 text-2xl">{product.name}</h2>
            <p className="mt-2 text-lg">
              {formatMoney(getEffectivePrice(product))}
              {isOnSale(product) ? (
                <span className="ml-2 text-sm text-luxe-gray-dark line-through">
                  {formatMoney(getListPrice(product))}
                </span>
              ) : null}
            </p>
            <p className="mt-4 text-sm text-luxe-gray-dark">{product.description}</p>

            <div className="mt-6">
              <p className="text-eyebrow mb-2">{t("color")} — {selectedColor}</p>
              <div className="flex items-center gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    aria-label={color.name}
                    onClick={() => setSelectedColor(color.name)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border-2 transition-colors",
                      selectedColor === color.name ? "border-luxe-black" : "border-transparent"
                    )}
                  >
                    <span className="block size-5 rounded-full border border-border" style={{ backgroundColor: color.hex }} />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-eyebrow mb-2">{t("size")}</p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => {
                  const purchasable = isSizePurchasable(product, size.name);
                  return (
                    <button
                      key={size.name}
                      type="button"
                      disabled={!purchasable}
                      onClick={() => setSelectedSize(size.name)}
                      className={cn(
                        "flex h-10 min-w-10 items-center justify-center border px-3 text-sm transition-colors",
                        !purchasable && "cursor-not-allowed border-border text-luxe-gray-dark/40 line-through",
                        purchasable && selectedSize === size.name && "border-luxe-black bg-luxe-black text-luxe-white",
                        purchasable && selectedSize !== size.name && "border-border hover:border-luxe-black"
                      )}
                    >
                      {size.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={!product.availableForSale || !selectedSize || isMutating}
              onClick={async () => {
                if (!selectedSize) return;
                await addItem({ productId: product.id, color: selectedColor, size: selectedSize, quantity: 1 });
                onOpenChange(false);
              }}
              className="mt-8 flex h-12 w-full items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {selectedSize ? t("addToBagCta") : t("selectASize")}
            </button>
            <a
              href={`/products/${product.slug}`}
              className="mt-3 text-center text-xs tracking-[0.05em] text-luxe-gray-dark uppercase underline underline-offset-4"
            >
              {t("viewFullDetails")}
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
