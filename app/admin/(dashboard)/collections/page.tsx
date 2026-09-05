import Image from "next/image";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { getAllCollections } from "@/services";
import type { Collection } from "@/types";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminCollectionsPage() {
  const collections = await getAllCollections();

  return (
    <div>
      <AdminPageHeader
        title="Collections"
        description={`${collections.length} collections.`}
        actions={
          <Link
            href="/admin/collections/new"
            className="flex h-9 items-center bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase"
          >
            New Collection
          </Link>
        }
      />

      <DataTable<Collection>
        columns={[
          {
            header: "Collection",
            cell: (row) => (
              <Link href={`/admin/collections/${row.id}`} className="flex items-center gap-3 hover:underline">
                <div className="relative size-12 shrink-0 overflow-hidden bg-luxe-gray-light">
                  <Image src={row.image.src} alt={row.image.alt} fill className="object-cover" />
                </div>
                <div>
                  <p>{row.title}</p>
                  <p className="text-xs text-luxe-gray-dark">/{row.slug}</p>
                </div>
              </Link>
            ),
          },
          { header: "Subtitle", cell: (row) => row.subtitle ?? "—" },
          { header: "Products", cell: (row) => row.productIds?.length ?? 0 },
        ]}
        rows={collections}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
