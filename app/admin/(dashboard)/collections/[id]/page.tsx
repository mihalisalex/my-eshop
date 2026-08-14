import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CollectionForm } from "@/components/admin/CollectionForm";
import { updateCollection, deleteCollection } from "@/app/admin/(dashboard)/collections/actions";
import { collectionToFormValues } from "@/lib/validation/collection";
import { getAllCollections } from "@/services/collections";
import { getAllProducts } from "@/services/products";

interface AdminCollectionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCollectionDetailPage({ params }: AdminCollectionDetailPageProps) {
  const { id } = await params;
  const [collections, products] = await Promise.all([getAllCollections(), getAllProducts({ includeUnpublished: true })]);
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
        onSubmit={boundUpdate}
        submitLabel="Save Changes"
      />
    </div>
  );
}
