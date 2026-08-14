"use server";

import { revalidatePath } from "next/cache";
import { capabilityDenied } from "@/lib/admin-session";
import { deleteImageFromBlob } from "@/lib/blob";
import { deleteMediaAssetRow, getMediaAssetById, getMediaUsage, updateMediaAsset } from "@/services/media";

export interface MediaActionState {
  error?: string;
  deleted?: number;
}

export async function updateMediaDetails(
  id: string,
  values: { altText?: string; folder?: string; tags?: string }
): Promise<MediaActionState> {
  const denied = await capabilityDenied("content:media");
  if (denied) return { error: denied };

  await updateMediaAsset(id, {
    altText: values.altText?.trim() || null,
    folder: values.folder?.trim() || null,
    // Comma-separated in the UI; stored as a real array.
    tags: (values.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  });

  revalidatePath("/admin/media");
  return {};
}

/**
 * Deletes the record AND the underlying blob, but refuses while the image is still
 * referenced anywhere. Without that check, deleting from the library would silently blank
 * a live product photo — the consumer stores the URL, so it would keep pointing at a file
 * that no longer exists and render as a broken image on the storefront.
 */
export async function deleteMediaAssets(ids: string[]): Promise<MediaActionState> {
  const denied = await capabilityDenied("content:media-delete");
  if (denied) return { error: denied };
  if (ids.length === 0) return { error: "Select at least one image." };

  const blocked: string[] = [];
  let deleted = 0;

  for (const id of ids) {
    const asset = await getMediaAssetById(id);
    if (!asset) continue;

    const usage = await getMediaUsage(asset.url);
    if (usage.length > 0) {
      blocked.push(`${asset.filename} (${usage[0].label}${usage.length > 1 ? ` +${usage.length - 1} more` : ""})`);
      continue;
    }

    // Row first, then blob: if the blob delete fails the admin can retry, whereas a
    // deleted blob with a surviving row would leave a permanently broken library entry.
    await deleteMediaAssetRow(id);
    await deleteImageFromBlob(asset.url);
    deleted++;
  }

  revalidatePath("/admin/media");

  if (blocked.length > 0) {
    return {
      deleted,
      error:
        `${blocked.length} image${blocked.length === 1 ? " is" : "s are"} still in use and ${blocked.length === 1 ? "was" : "were"} not deleted: ` +
        `${blocked.slice(0, 3).join("; ")}${blocked.length > 3 ? "…" : ""}. Remove ${blocked.length === 1 ? "it" : "them"} from those first.`,
    };
  }
  return { deleted };
}
