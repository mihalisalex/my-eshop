import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { MediaUploadButton } from "@/components/admin/MediaUploadButton";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";
import { roleHasCapability } from "@/constants/permissions";
import { DEFAULT_PAGE_SIZE, parsePage, parseSearch } from "@/lib/pagination";
import { listMediaForAdmin, getMediaFolders, type MediaUsageFilter } from "@/services/media";

const USAGE_FILTERS: MediaUsageFilter[] = ["all", "used", "unused"];

interface AdminMediaPageProps {
  searchParams: Promise<{ q?: string; folder?: string; usage?: string; page?: string }>;
}

/**
 * Reads the real media_assets table. This page used to derive its list by scanning
 * products/collections/homepage for image URLs and deduping — which meant a freshly
 * uploaded file didn't appear until it was attached to something, and nothing could carry
 * alt text, a folder, tags, or be deleted.
 *
 * Filtering and paging now happen server-side (QA-046): the grid receives one page rather
 * than all 317 assets.
 */
export default async function AdminMediaPage({ searchParams }: AdminMediaPageProps) {
  const session = await requireCapabilityOrRedirect("content:media");
  const params = await searchParams;

  const search = parseSearch(params.q);
  const folder = parseSearch(params.folder) || undefined;
  const usage = USAGE_FILTERS.includes(params.usage as MediaUsageFilter) ? (params.usage as MediaUsageFilter) : "all";

  const [paged, folders] = await Promise.all([
    listMediaForAdmin({ search, folder, usage, page: parsePage(params.page), pageSize: DEFAULT_PAGE_SIZE }),
    getMediaFolders(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Media Library"
        description={`${paged.libraryTotal} images · ${paged.unusedTotal} unused. Uploads appear here immediately, before being attached to anything.`}
        actions={<MediaUploadButton />}
      />

      <MediaLibrary
        assets={paged.rows}
        total={paged.total}
        page={paged.page}
        pageCount={paged.pageCount}
        filter={{ q: search, folder, usage }}
        folders={folders}
        canDelete={roleHasCapability(session.role, "content:media-delete")}
      />
    </div>
  );
}
