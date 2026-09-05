import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CollectionForm } from "@/components/admin/CollectionForm";
import { updateCollection, deleteCollection } from "@/app/admin/(dashboard)/collections/actions";
import { collectionToFormValues } from "@/lib/validation/collection";
import { getAllCollections } from "@/services/collections";
import { getAllProducts } from "@/services/products";
import { getSeoDefaults } from "@/services/seo";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

interface AdminCollectionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCollectionDetailPage({ params }: AdminCollectionDetailPageProps) {
  const { id } = await params;
  const [collections, products, seo] = await Promise.all([
    getAllCollections(),
    getAllProducts({ includeUnpublished: true }),
    getSeoDefaults(),
  ]);
  const collection = collections.find((c) => c.id === id);
  if (!collection) notFound();

  const boundUpdate = updateCollection.bind(null, id);
  const boundDelete = deleteCollection.bind(null, id);

  return (
    <div>
      <AdminPageHeader
        title={collection.title}
        description={`/${collection.slug}`}
        actions={
          <form action={boundDelete}>
            <button
              type="submit"
              className="h-9 border border-destructive px-4 text-xs font-medium tracking-[0.05em] text-destructive uppercase"
            >
              Delete Collection
            </button>
          </form>
        }
      />
      <CollectionForm
        defaultValues={collectionToFormValues(collection)}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
        seoDefaults={{ siteUrl: seo.siteUrl, titleTemplate: seo.titleTemplate }}
        onSubmit={boundUpdate}
        submitLabel="Save Changes"
      />
    </div>
  );
}
