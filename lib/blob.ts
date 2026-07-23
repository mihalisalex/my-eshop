import "server-only";
import { put } from "@vercel/blob";

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Uploads one image file to Vercel Blob under a collision-resistant path. Used by both
 * the Media Library's upload button and the CSV bulk-import tool's per-row image
 * resolution — one upload path, not two to keep in sync.
 */
export async function uploadImageToBlob(file: File): Promise<{ url: string }> {
  if (!isBlobConfigured()) {
    throw new Error("Image uploads aren't configured yet — connect a Blob store to this project in the Vercel dashboard (Storage tab) and set BLOB_READ_WRITE_TOKEN.");
  }
  const blob = await put(`products/${crypto.randomUUID()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: false,
  });
  return { url: blob.url };
}
