import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/types";

interface RelatedProductsProps {
  title: string;
  products: Product[];
}

export function RelatedProducts({ title, products }: RelatedProductsProps) {
  if (products.length === 0) return null;

  return (
    <section className="border-t border-border py-10">
      <h2 className="font-heading text-2xl">{title}</h2>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
