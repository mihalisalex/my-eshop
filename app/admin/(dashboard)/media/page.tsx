import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { MediaUploadButton } from "@/components/admin/MediaUploadButton";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";
import { roleHasCapability } from "@/constants/permissions";
import { getAllMediaAssetsWithUsage, getMediaFolders } from "@/services/media";

/**
 * Reads the real media_assets table. This page used to derive its list by scanning
 * products/collections/homepage for image URLs and deduping — which meant a freshly
 * uploaded file didn't appear until it was attached to something, and nothing could carry
 * alt text, a folder, tags, or be deleted.
 */
export default async function AdminMediaPage() {
  const session = await requireCapabilityOrRedirect("content:media");
  const [assets, folders] = await Promise.all([getAllMediaAssetsWithUsage(), getMediaFolders()]);

  const unused = assets.filter((a) => a.usage.length === 0).length;

  return (
    <div>
      <AdminPageHeader
        title="Media Library"
        description={`${assets.length} images · ${unused} unused. Uploads appear here immediately, before being attached to anything.`}
        actions={<MediaUploadButton />}
      />

      <MediaLibrary
        assets={assets}
        folders={folders}
        canDelete={roleHasCapability(session.role, "content:media-delete")}
      />
    </div>
  );
}
