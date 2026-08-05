import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { getAllProducts } from "@/services";
import { getAllCategories } from "@/services/categories";

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([
    // Admin sees every lifecycle state — this is the one surface that must.
    getAllProducts({ includeUnpublished: true }),
    getAllCategories(),
  ]);

  const counts = products.reduce<Record<string, number>>((acc, product) => {
    acc[product.status] = (acc[product.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <AdminPageHeader
        title="Products"
        description={`${products.length} products · ${counts.active ?? 0} active · ${counts.draft ?? 0} draft · ${counts.archived ?? 0} archived`}
        actions={
          <Link
            href="/admin/products/new"
            className="flex h-9 items-center bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase"
          >
            New Product
          </Link>
        }
      />

      <ProductsTable
        products={products}
        categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
      />
    </div>
  );
}
