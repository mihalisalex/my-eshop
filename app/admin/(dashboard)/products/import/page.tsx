import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ProductsImportForm } from "@/components/admin/ProductsImportForm";

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
