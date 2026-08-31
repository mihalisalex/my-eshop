import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CollectionForm } from "@/components/admin/CollectionForm";
import { createCollection } from "@/app/admin/(dashboard)/collections/actions";
import { emptyCollectionFormValues } from "@/lib/validation/collection";
import { getAllProducts } from "@/services/products";
import { getSeoDefaults } from "@/services/seo";

export default async function NewCollectionPage() {
  const [products, seo] = await Promise.all([getAllProducts({ includeUnpublished: true }), getSeoDefaults()]);

  return (
    <div>
      <AdminPageHeader title="New Collection" description="Add a new collection." />
      <CollectionForm
        defaultValues={emptyCollectionFormValues}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
        seoDefaults={{ siteUrl: seo.siteUrl, titleTemplate: seo.titleTemplate }}
        onSubmit={createCollection}
        submitLabel="Create Collection"
      />
    </div>
  );
}
