import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { getAllProducts } from "@/services";

interface CategoryRow {
  name: string;
  count: number;
}

export default async function AdminCategoriesPage() {
  const products = await getAllProducts();
  const counts = new Map<string, number>();
  for (const product of products) {
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }
  const rows: CategoryRow[] = Array.from(counts.entries()).map(([name, count]) => ({ name, count }));

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        description="Categories are derived from product data today; promote this to a managed taxonomy when the catalog moves to a real backend."
      />

      <DataTable<CategoryRow>
        columns={[
          { header: "Category", cell: (row) => <span className="capitalize">{row.name}</span> },
          { header: "Products", cell: (row) => row.count },
        ]}
        rows={rows}
        getRowKey={(row) => row.name}
      />
    </div>
  );
}
