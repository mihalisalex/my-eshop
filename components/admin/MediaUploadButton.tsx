"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Uploads directly to /api/admin/media/upload (Vercel Blob). Note this only puts a file
 * in storage — the Media Library page's own listing is derived read-only from images
 * already referenced by a product/collection/homepage section (see media/page.tsx), so
 * a freshly uploaded image won't appear here until it's attached to something. That's a
 * page-behavior note, not a bug in this button.
 */
export function MediaUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setStatus("uploading");
    try {
      const form = new FormData();
      for (const file of Array.from(fileList)) form.append("file", file);
      const res = await fetch("/api/admin/media/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      setStatus("idle");
      router.refresh();
    } catch {
      setStatus("error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
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
      {status === "error" ? (
        <p className="absolute top-full right-0 mt-1 w-56 text-right text-xs text-destructive">
          Upload failed. Is a Blob store connected?
        </p>
      ) : null}
    </div>
  );
}
