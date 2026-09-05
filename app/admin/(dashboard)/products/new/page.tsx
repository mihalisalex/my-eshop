import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ProductForm } from "@/components/admin/ProductForm";
import { createProduct } from "@/app/admin/(dashboard)/products/actions";
import { emptyProductFormValues } from "@/lib/validation/product";
import { getAllCollections } from "@/services/collections";
import { getCategoryOptions } from "@/services/categories";
import { getSeoDefaults } from "@/services/seo";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function NewProductPage() {
  const [collections, categories, seo] = await Promise.all([
    getAllCollections(),
    getCategoryOptions(),
    getSeoDefaults(),
  ]);

  return (
    <div>
      <AdminPageHeader title="New Product" description="Add a new product to the catalog." />
      <ProductForm
        defaultValues={emptyProductFormValues}
        collections={collections.map((c) => ({ id: c.id, title: c.title }))}
        categories={categories}
        seoDefaults={{ siteUrl: seo.siteUrl, titleTemplate: seo.titleTemplate }}
        onSubmit={createProduct}
        submitLabel="Create Product"
      />
    </div>
  );
}
