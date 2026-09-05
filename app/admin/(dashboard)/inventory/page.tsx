import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { ListFilterBar } from "@/components/admin/ListFilterBar";
import { Pagination } from "@/components/admin/Pagination";
import { DEFAULT_PAGE_SIZE, parsePage, parseSearch } from "@/lib/pagination";
import {
  getInventorySummary,
  listInventory,
  LOW_STOCK_THRESHOLD,
  type InventoryRow,
  type StockFilter,
} from "@/services/inventory";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

interface AdminInventoryPageProps {
  searchParams: Promise<{ q?: string; stock?: string; page?: string }>;
}

const STOCK_OPTIONS: { value: StockFilter; label: string }[] = [
  { value: "out", label: "Out of stock" },
  { value: "low", label: `Low stock (≤ ${LOW_STOCK_THRESHOLD})` },
  { value: "in", label: "In stock" },
];

function isStockFilter(value: string | undefined): value is StockFilter {
  return value === "low" || value === "out" || value === "in";
}

export default async function AdminInventoryPage({ searchParams }: AdminInventoryPageProps) {
  const params = await searchParams;
  const search = parseSearch(params.q);
  const stock = isStockFilter(params.stock) ? params.stock : undefined;

  const [{ rows, total, page, pageCount, pageSize }, summary] = await Promise.all([
    listInventory({ search, stock, page: parsePage(params.page), pageSize: DEFAULT_PAGE_SIZE }),
    getInventorySummary(),
  ]);

  const isFiltered = Boolean(search || stock);

  return (
    <div>
      <AdminPageHeader
        title="Inventory"
        description={`${summary.variants} size variants across ${summary.products} products · ${summary.low} low stock · ${summary.out} out of stock`}
      />

      <ListFilterBar
        action="/admin/inventory"
        searchValue={search}
        searchPlaceholder="Search product or SKU"
        selects={[{ name: "stock", label: "All stock levels", value: stock ?? "", options: STOCK_OPTIONS }]}
      />

      {total === 0 ? (
        <p className="border border-border bg-luxe-white p-8 text-center text-sm text-luxe-gray-dark">
          {isFiltered ? "No variants match those filters." : "No inventory yet."}
        </p>
      ) : (
        <>
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
              { header: "Quantity", cell: (row) => <span className="tabular-nums">{row.quantity}</span> },
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

          <Pagination
            basePath="/admin/inventory"
            params={{ q: search, stock }}
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            label="variants"
          />
        </>
      )}
    </div>
  );
}
