"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Uploads to /api/admin/media/upload, which stores the file in Vercel Blob AND records a
 * MediaAsset — so an uploaded image appears in the library straight away. (It previously
 * only wrote to storage, and the library listed images already referenced elsewhere, so a
 * fresh upload was invisible until someone attached it to a product.)
 *
 * Exported as a hook-shaped helper as well, so the library's drop zone and this button
 * share one upload path rather than two that can drift.
 */
export interface UploadedMedia {
  url: string;
  filename: string;
}

/**
 * Returns the stored URLs, not just success. The Media Library only needed to know the
 * upload worked and then refresh; the product form needs the URLs themselves, so it can
 * attach the images to the product without anyone copying a link out of one screen and
 * into another.
 */
export async function uploadMediaFiles(
  files: File[]
): Promise<{ ok: true; media: UploadedMedia[] } | { ok: false; error: string }> {
  const form = new FormData();
  for (const file of files) {
    form.append("file", file);
    const size = await measureImage(file);
    // Keyed by filename so the server can pair dimensions back up with the right file.
    if (size) form.append(`dimensions:${file.name}`, `${size.width}x${size.height}`);
  }

  const res = await fetch("/api/admin/media/upload", { method: "POST", body: form });
  if (res.ok) {
    const body = (await res.json()) as { assets?: { url: string; filename: string }[] };
    return { ok: true, media: (body.assets ?? []).map((a) => ({ url: a.url, filename: a.filename })) };
  }

  const body = await res.json().catch(() => null);
  return { ok: false, error: body?.error?.message ?? "Upload failed. Is a Blob store connected?" };
}

/**
 * Reads intrinsic dimensions before upload. Resolves null rather than rejecting for
 * anything undecodable (SVG without intrinsic size, a corrupt file) — missing metadata
 * must never be the reason an otherwise-valid upload fails.
 *
 * Deliberately does NOT go through `URL.createObjectURL`: this app's CSP is
 * `img-src 'self' data: …` (next.config.ts), so an <img> pointed at a `blob:` URL is
 * blocked before it decodes. That failure is completely silent — it surfaces as `onerror`,
 * indistinguishable from a corrupt file — so every upload was quietly recorded with no
 * dimensions at all. `createImageBitmap` decodes the File itself and never involves a URL,
 * and the fallback below uses a `data:` URL, which the policy does allow.
 */
async function measureImage(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return null;

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const size = bitmap.width && bitmap.height ? { width: bitmap.width, height: bitmap.height } : null;
      bitmap.close();
      if (size) return size;
    } catch {
      // Some formats (notably SVG) can't be decoded this way — fall through to the <img>.
    }
  }

  return measureViaDataUrl(file);
}

function measureViaDataUrl(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () =>
        resolve(img.naturalWidth && img.naturalHeight ? { width: img.naturalWidth, height: img.naturalHeight } : null);
      img.onerror = () => resolve(null);
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function MediaUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setStatus("uploading");
    const result = await uploadMediaFiles(Array.from(fileList));
    if (result.ok) {
      setStatus("idle");
      setError(null);
      router.refresh();
    } else {
      setStatus("error");
      setError(result.error ?? null);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading"}
        className="h-9 bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase disabled:opacity-50"
      >
        {status === "uploading" ? "Uploading…" : "Upload"}
      </button>
      {status === "error" && error ? (
        <p className="absolute top-full right-0 mt-1 w-64 text-right text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
