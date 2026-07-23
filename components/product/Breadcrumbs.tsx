import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { BreadcrumbItem } from "@/types";

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="container-luxe flex items-center gap-1.5 py-4 text-xs text-luxe-gray-dark">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={item.href} className="flex items-center gap-1.5">
            {index > 0 ? <ChevronRight className="size-3" strokeWidth={1.5} /> : null}
            {isLast ? (
              <span aria-current="page" className="text-luxe-black">
                {item.name}
              </span>
            ) : (
              <Link href={item.href} className="transition-colors hover:text-luxe-black">
                {item.name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
