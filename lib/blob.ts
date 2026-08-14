import "server-only";
import { del, put } from "@vercel/blob";

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

const NOT_CONFIGURED =
  "Image uploads aren't configured yet — connect a Blob store to this project in the Vercel dashboard (Storage tab) and set BLOB_READ_WRITE_TOKEN.";

export interface UploadedBlob {
  url: string;
  pathname: string;
  contentType?: string;
}

/**
 * Uploads one image file to Vercel Blob under a collision-resistant path. Used by both
 * the Media Library's upload button and the CSV bulk-import tool's per-row image
 * resolution — one upload path, not two to keep in sync.
 *
 * Returns `pathname` as well as `url` because deletion targets the store by key, and the
 * caller records both so an asset can be removed later.
 */
export async function uploadImageToBlob(file: File): Promise<UploadedBlob> {
  if (!isBlobConfigured()) throw new Error(NOT_CONFIGURED);

  const blob = await put(`products/${crypto.randomUUID()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: false,
  });
  return { url: blob.url, pathname: blob.pathname, contentType: blob.contentType };
}

/**
 * Removes the underlying object so a deleted library asset doesn't keep costing storage.
 * Deliberately tolerant of an already-missing object: the DB row is the thing the admin
 * sees, and refusing to clear it because the blob was already gone would leave a broken
 * entry they can't get rid of.
 */
export async function deleteImageFromBlob(url: string): Promise<{ deleted: boolean; reason?: string }> {
  if (!isBlobConfigured()) return { deleted: false, reason: NOT_CONFIGURED };
  try {
    await del(url);
    return { deleted: true };
  } catch (error) {
    return { deleted: false, reason: error instanceof Error ? error.message : "Blob delete failed." };
  }
}
