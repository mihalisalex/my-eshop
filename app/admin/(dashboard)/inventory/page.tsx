import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { getAllProducts } from "@/services";

interface InventoryRow {
  key: string;
  productId: string;
  productName: string;
  sizeName: string;
  sku?: string;
  quantity: number;
  inStock: boolean;
}

const LOW_STOCK_THRESHOLD = 3;

export default async function AdminInventoryPage() {
  const products = await getAllProducts({ includeUnpublished: true });

  const rows: InventoryRow[] = products.flatMap((product) =>
    product.sizes.map((size) => ({
      key: `${product.id}-${size.name}`,
      productId: product.id,
      productName: product.name,
      sizeName: size.name,
      sku: size.sku ?? product.sku,
      quantity: size.quantity,
      inStock: size.inStock,
    }))
  );

  const lowStockCount = rows.filter((row) => row.inStock && row.quantity > 0 && row.quantity <= LOW_STOCK_THRESHOLD).length;
  const outOfStockCount = rows.filter((row) => !row.inStock || row.quantity === 0).length;

  return (
    <div>
      <AdminPageHeader
        title="Inventory"
        description={`${rows.length} size variants across ${products.length} products · ${lowStockCount} low stock · ${outOfStockCount} out of stock`}
      />

      <DataTable<InventoryRow>
        columns={[
          {
            header: "Product",
            cell: (row) => (
              <Link href={`/admin/products/${row.productId}`} className="hover:underline">
                {row.productName}
              </Link>
            ),
          },
          { header: "Size", cell: (row) => row.sizeName },
          { header: "SKU", cell: (row) => <span className="font-mono text-xs">{row.sku}</span> },
          { header: "Quantity", cell: (row) => row.quantity },
          {
            header: "Status",
            cell: (row) => {
              if (!row.inStock || row.quantity === 0) {
                return <span className="text-destructive">Out of stock</span>;
              }
              if (row.quantity <= LOW_STOCK_THRESHOLD) {
                return <span className="text-amber-600">Low stock</span>;
              }
              return <span className="text-green-700">In stock</span>;
            },
          },
        ]}
        rows={rows}
        getRowKey={(row) => row.key}
      />
    </div>
  );
}
