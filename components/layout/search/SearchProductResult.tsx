import Link from "next/link";
import Image from "next/image";
import { formatMoney } from "@/lib/format";
import { getEffectivePrice, getListPrice, isOnSale } from "@/lib/product";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

interface SearchProductResultProps {
  product: Product;
  active: boolean;
  onNavigate: () => void;
}

export function SearchProductResult({ product, active, onNavigate }: SearchProductResultProps) {
  const effectivePrice = getEffectivePrice(product);
  const [image] = product.images;

  return (
    <Link
      href={`/products/${product.slug}`}
      onClick={onNavigate}
      data-active={active}
      className={cn(
        "flex items-center gap-4 px-2 py-2.5 transition-colors",
        active ? "bg-luxe-gray-light" : "hover:bg-luxe-gray-light"
      )}
    >
      <div className="relative size-14 shrink-0 overflow-hidden bg-luxe-gray-light">
        <Image src={image.src} alt={image.alt} fill sizes="56px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{product.name}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs">
          <span className={isOnSale(product) ? "text-destructive" : "text-luxe-gray-dark"}>{formatMoney(effectivePrice)}</span>
          {isOnSale(product) ? (
            <span className="text-luxe-gray-dark line-through">{formatMoney(getListPrice(product))}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
