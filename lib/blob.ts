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

/** 12 MB. Comfortably above a high-resolution product photograph, far below a video. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/**
 * The formats the storefront actually renders, identified by their leading bytes rather
 * than by the extension or the browser-supplied `Content-Type` — both of which are simply
 * whatever the uploader said.
 *
 * SVG is deliberately absent and must stay absent. It is XML, it can carry `<script>`, and
 * Blob serves it as `image/svg+xml` from a host that this app's own CSP `img-src` trusts
 * (next.config.ts derives that list from REMOTE_IMAGE_HOSTS). Uploading one is enough to
 * host active content under a domain the shop vouches for. There is no signature to detect
 * it by either — it is text — so it is excluded by not being on this list at all.
 */
const IMAGE_SIGNATURES: { type: string; matches: (bytes: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/png",
    matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  { type: "image/gif", matches: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  // Both are ISO-BMFF: "....ftyp" at offset 4, then the brand. WebP is RIFF instead.
  { type: "image/webp", matches: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP" },
  { type: "image/avif", matches: (b) => ascii(b, 4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(b, 8, 4)) },
];

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/**
 * The real content type, or null if the bytes are not one of the formats above.
 *
 * Reads only the first 16 bytes rather than buffering the whole file to inspect it.
 */
async function sniffImageType(file: File): Promise<string | null> {
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return IMAGE_SIGNATURES.find((signature) => signature.matches(header))?.type ?? null;
}

/**
 * Strips everything a filename could smuggle into a storage key or a URL: path separators,
 * traversal, control characters, and anything outside a conservative allowlist.
 *
 * The name still goes into the object key — it is genuinely useful to see
 * `products/<uuid>-loafer-black.jpg` rather than `products/<uuid>` in the Blob dashboard —
 * but only after it has stopped being attacker-controlled text.
 */
export function safeUploadFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";

  /**
   * Stem and extension are sanitised separately so the extension survives.
   *
   * This catalogue is Greek, so a name made entirely of non-ASCII characters is the normal
   * case rather than an edge one — and sanitising the whole string in one pass reduced
   * "παπούτσι.jpg" to "jpg", silently swallowing the extension into the stem. Blob and
   * every browser downstream use that extension.
   */
  const lastDot = base.lastIndexOf(".");
  const hasExtension = lastDot > 0 && lastDot < base.length - 1;
  const rawStem = hasExtension ? base.slice(0, lastDot) : base;
  const rawExtension = hasExtension ? base.slice(lastDot + 1) : "";

  // Anything outside the allowlist becomes a hyphen, which covers control characters,
  // whitespace, quotes, percent-encoding and every non-ASCII script in one rule.
  const clean = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[.-]+/, "")
      .replace(/[.-]+$/, "");

  const stem = clean(rawStem).slice(0, 60) || "upload";
  const extension = clean(rawExtension).slice(0, 10);
  return extension ? `${stem}.${extension}` : stem;
}

export class UploadRejectedError extends Error {}

/**
 * Uploads one image file to Vercel Blob under a collision-resistant path. Used by both
 * the Media Library's upload button and the CSV bulk-import tool's per-row image
 * resolution — one upload path, not two to keep in sync, which is also why the validation
 * belongs here rather than in the route handler.
 *
 * Returns `pathname` as well as `url` because deletion targets the store by key, and the
 * caller records both so an asset can be removed later.
 */
export async function uploadImageToBlob(file: File): Promise<UploadedBlob> {
  if (!isBlobConfigured()) throw new Error(NOT_CONFIGURED);

  if (file.size === 0) {
    throw new UploadRejectedError(`"${file.name}" is empty.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const limitMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    throw new UploadRejectedError(`"${file.name}" is larger than ${limitMb} MB — resize it and try again.`);
  }

  // The declared type is ignored in favour of the actual bytes. A file called .jpg with an
  // HTML payload is served by its stored content type, so trusting the label would let one
  // through — and the same upload path is reachable by the `content:media` capability,
  // which editors hold.
  const contentType = await sniffImageType(file);
  if (!contentType) {
    throw new UploadRejectedError(`"${file.name}" isn't a JPEG, PNG, WebP, AVIF or GIF image.`);
  }

  const blob = await put(`products/${crypto.randomUUID()}-${safeUploadFilename(file.name)}`, file, {
    access: "public",
    addRandomSuffix: false,
    // Set from the sniffed type, not from what the browser claimed, so what Blob serves
    // matches what the bytes actually are.
    contentType,
  });
  return { url: blob.url, pathname: blob.pathname, contentType: blob.contentType ?? contentType };
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
