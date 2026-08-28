import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import type { Collection } from "@/types";

interface SearchCollectionResultProps {
  collection: Collection;
  active: boolean;
  onNavigate: () => void;
}

export function SearchCollectionResult({ collection, active, onNavigate }: SearchCollectionResultProps) {
  const t = useTranslations("Search");
  return (
    <Link
      href={`/collections/${collection.slug}`}
      onClick={onNavigate}
      data-active={active}
      className={cn(
        "flex items-center gap-4 px-2 py-2.5 transition-colors",
        active ? "bg-luxe-gray-light" : "hover:bg-luxe-gray-light"
      )}
    >
      <div className="relative size-14 shrink-0 overflow-hidden bg-luxe-gray-light">
        <Image src={collection.image.src} alt={collection.image.alt} fill sizes="56px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{collection.title}</p>
        <p className="text-xs text-luxe-gray-dark">{t("collection")}</p>
      </div>
    </Link>
  );
}
