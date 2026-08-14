"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Uploads to /api/admin/media/upload, which stores the file in Vercel Blob AND records a
 * MediaAsset — so an uploaded image appears in the library straight away. (It previously
 * only wrote to storage, and the library listed images already referenced elsewhere, so a
 * fresh upload was invisible until someone attached it to a product.)
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
