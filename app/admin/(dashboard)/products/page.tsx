import Image from "next/image";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { formatMoney } from "@/lib/format";
import { getAllProducts } from "@/services";
import type { Product } from "@/types";

export default async function AdminProductsPage() {
  const products = await getAllProducts();

  return (
    <div>
      <AdminPageHeader
        title="Products"
        description={`${products.length} products in the catalog.`}
        actions={
          <Link
            href="/admin/products/new"
            className="flex h-9 items-center bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase"
          >
            New Product
          </Link>
        }
      />

      <DataTable<Product>
        columns={[
          {
            header: "Product",
            cell: (row) => (
              <Link href={`/admin/products/${row.id}`} className="flex items-center gap-3 hover:underline">
                <div className="relative size-12 shrink-0 overflow-hidden bg-luxe-gray-light">
                  <Image src={row.images[0].src} alt={row.images[0].alt} fill className="object-cover" />
                </div>
                <div>
                  <p>{row.name}</p>
                  <p className="text-xs text-luxe-gray-dark">{row.sku}</p>
                </div>
              </Link>
            ),
          },
          { header: "Category", cell: (row) => <span className="capitalize">{row.category}</span> },
          { header: "Price", cell: (row) => formatMoney(row.price) },
          {
            header: "Status",
            cell: (row) => (
              <span
                className={
                  row.availableForSale ? "text-green-700" : "text-luxe-gray-dark"
                }
              >
                {row.availableForSale ? "Active" : "Draft"}
              </span>
            ),
          },
          {
            header: "Tags",
            cell: (row) => row.tags.join(", "),
            className: "text-luxe-gray-dark",
          },
        ]}
        rows={products}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
