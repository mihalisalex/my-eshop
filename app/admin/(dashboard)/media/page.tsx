import Image from "next/image";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MediaUploadButton } from "@/components/admin/MediaUploadButton";
import { getAllCollections, getAllProducts, getHomepageConfig } from "@/services";
import type { Image as ImageType } from "@/types";

async function getAllMedia(): Promise<ImageType[]> {
  const [products, collections, homepage] = await Promise.all([
    getAllProducts({ includeUnpublished: true }),
    getAllCollections(),
    getHomepageConfig(),
  ]);

  const images: ImageType[] = [
    ...products.flatMap((p) => p.images),
    ...collections.map((c) => c.image),
  ];

  for (const section of homepage.sections) {
    if ("image" in section.data && section.data.image) images.push(section.data.image);
    if ("images" in section.data && Array.isArray(section.data.images)) images.push(...section.data.images);
  }

  const seen = new Set<string>();
  return images.filter((image) => {
    if (seen.has(image.src)) return false;
    seen.add(image.src);
    return true;
  });
}

export default async function AdminMediaPage() {
  const media = await getAllMedia();

  return (
    <div>
      <AdminPageHeader
        title="Media Library"
        description={`${media.length} images currently referenced across the site. Swap this for a real DAM/CDN integration later.`}
        actions={<MediaUploadButton />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {media.map((image) => (
          <div key={image.src} className="group relative aspect-square overflow-hidden border border-border bg-luxe-white">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="200px"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
