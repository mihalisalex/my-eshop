"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getEffectivePrice, isOnSale, isSizePurchasable } from "@/lib/product";
import { useCart } from "@/components/providers/CartProvider";
import type { Product } from "@/types";

interface QuickAddSheetProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The mobile counterpart to `QuickViewDialog` — deliberately NOT the same component
 * at a smaller width.
 *
 * `QuickViewDialog` measures 1072px tall on a 375x812 phone, is centred, and does not
 * scroll internally, so it is clipped at both ends and its "add to bag" button sits
 * off-screen. Making it fit would mean rebuilding it anyway, and the result would still
 * be a cramped product page shown on top of the product page it replaced — less imagery,
 * no gallery, no size guide — for a customer whose back button is free.
 *
 * So this sheet does the one thing that genuinely saves a step on a phone: pick a size,
 * add to bag. Everything else stays on the PDP, one tap away via the link at the bottom.
 * Colour is shown but not selectable, because a colour on this catalogue is a separate
 * product rather than a variant of this one — offering a picker here would imply the
 * choice changes what gets added, and it would not.
 */
export function QuickAddSheet({ product, open, onOpenChange }: QuickAddSheetProps) {
  const t = useTranslations("QuickAdd");
  const { addItem, isMutating } = useCart();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  // A card can be re-opened after a successful add; leaving the previous size selected
  // would let a double-tap add a size the customer never looked at this time round.
  // Done on close rather than in an effect on `open` — an effect that setStates
  // synchronously just triggers a second render to undo the first.
  function handleOpenChange(next: boolean) {
    if (!next) setSelectedSize(null);
    onOpenChange(next);
  }

  const soldOut = !product.availableForSale;
  const price = getEffectivePrice(product);
  const [image] = product.images;
  const colorName = product.colors[0]?.name;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        /* max-h + overflow so a product with many sizes scrolls the sheet instead of
           pushing the add button past the bottom of the screen — the exact failure the
           quick-view dialog has. */
        className="max-h-[85svh] gap-0 overflow-y-auto rounded-none p-0"
      >
        <SheetTitle className="sr-only">{product.name}</SheetTitle>

        <div className="flex items-stretch gap-4 border-b border-border p-4">
          {/* The reason the sheet exists is to look at the shoe, so the photograph gets the
              space: a bordered 3:4 frame at 42% of the sheet, ~9x the area of the 64px
              thumbnail it replaces, and tappable through to the full gallery. */}
          <Link
            href={`/products/${product.slug}`}
            className="relative aspect-3/4 w-[42%] max-w-44 shrink-0 overflow-hidden border border-border bg-luxe-gray-light"
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(max-width: 480px) 42vw, 176px"
              className="object-cover"
            />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="line-clamp-3 text-sm leading-snug">{product.name}</p>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className={isOnSale(product) ? "text-destructive" : ""}>{formatMoney(price)}</span>
              {isOnSale(product) && product.compareAtPrice ? (
                <span className="text-luxe-gray-dark line-through">{formatMoney(product.compareAtPrice)}</span>
              ) : null}
            </div>
            {colorName ? (
              <p className="mt-2 text-[10px] tracking-[0.15em] text-luxe-gray-dark uppercase">
                {t("color")}: {colorName}
              </p>
            ) : null}
          </div>
        </div>

        <div className="p-4">
          <p className="text-eyebrow mb-3">{t("size")}</p>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((size) => {
              const purchasable = isSizePurchasable(product, size.name);
              return (
                <button
                  key={size.name}
                  type="button"
                  disabled={!purchasable}
                  aria-pressed={selectedSize === size.name}
                  aria-label={purchasable ? size.name : `${size.name} — ${t("sizeUnavailable")}`}
                  onClick={() => setSelectedSize(size.name)}
                  /* h-12/min-w-12 rather than the dialog's h-10/min-w-10: this one is
                     driven by a thumb, and 48px is the accessible touch-target floor. */
                  className={cn(
                    "flex h-12 min-w-12 items-center justify-center border px-3 text-sm transition-colors",
                    !purchasable && "cursor-not-allowed border-border text-luxe-gray-dark/40 line-through",
                    purchasable && selectedSize === size.name && "border-luxe-black bg-luxe-black text-luxe-white",
                    purchasable && selectedSize !== size.name && "border-border"
                  )}
                >
                  {size.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-background p-4">
          <button
            type="button"
            disabled={soldOut || !selectedSize || isMutating}
            onClick={async () => {
              if (!selectedSize) return;
              await addItem({
                productId: product.id,
                color: colorName ?? "",
                size: selectedSize,
                quantity: 1,
              });
              handleOpenChange(false);
            }}
            className="flex h-12 w-full items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity disabled:opacity-40"
          >
            {soldOut ? t("soldOut") : selectedSize ? t("addToBag") : t("selectSize")}
          </button>
          <Link
            href={`/products/${product.slug}`}
            className="text-center text-xs tracking-[0.05em] text-luxe-gray-dark uppercase underline underline-offset-4"
          >
            {t("viewDetails")}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
