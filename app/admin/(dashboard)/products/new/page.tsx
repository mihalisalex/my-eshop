import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ProductForm } from "@/components/admin/ProductForm";
import { createProduct } from "@/app/admin/(dashboard)/products/actions";
import { emptyProductFormValues } from "@/lib/validation/product";
import { getAllCollections } from "@/services/collections";
import { getCategoryOptions } from "@/services/categories";

export default async function NewProductPage() {
  const [collections, categories] = await Promise.all([getAllCollections(), getCategoryOptions()]);

  return (
    <div>
      <AdminPageHeader title="New Product" description="Add a new product to the catalog." />
      <ProductForm
        defaultValues={emptyProductFormValues}
        collections={collections.map((c) => ({ id: c.id, title: c.title }))}
        categories={categories}
        onSubmit={createProduct}
        submitLabel="Create Product"
      />
    </div>
  );
}
