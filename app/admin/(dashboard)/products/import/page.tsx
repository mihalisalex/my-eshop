import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ProductsImportForm } from "@/components/admin/ProductsImportForm";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function ProductsImportPage() {
  return (
    <div>
      <AdminPageHeader
        title="Import Products"
        description="Bulk-create or update products from a CSV file, with optional image uploads."
      />
      <ProductsImportForm />
    </div>
  );
}
