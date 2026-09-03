"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isOptimizableImageUrl } from "@/lib/image-hosts";
import { Check, Copy, Lock, Upload } from "lucide-react";
import { ListFilterBar } from "@/components/admin/ListFilterBar";
import { Pagination } from "@/components/admin/Pagination";
import { bulkOrganiseMedia, deleteMediaAssets, updateMediaDetails } from "@/app/admin/(dashboard)/media/actions";
import { uploadMediaFiles } from "@/components/admin/MediaUploadButton";
import type { MediaAssetWithUsage } from "@/types/media";

export interface MediaLibraryFilter {
  q: string;
  folder?: string;
  usage: string;
}

interface MediaLibraryProps {
  /** One page of assets, already filtered and paged by the server (QA-046). */
  assets: MediaAssetWithUsage[];
  total: number;
  page: number;
  pageCount: number;
  filter: MediaLibraryFilter;
  folders: string[];
  canDelete: boolean;
}

const PAGE_SIZE = 25;

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaLibrary({ assets, total, page, pageCount, filter, folders, canDelete }: MediaLibraryProps) {
  // Selection is scoped to the page on screen. An invisible selection that survives paging
  // is how someone deletes 300 images believing they selected three — and unlike products,
  // deletion here also removes the file from storage.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<MediaAssetWithUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkFolder, setBulkFolder] = useState("");
  const [bulkTags, setBulkTags] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleDroppedFiles(fileList: FileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) {
      setError("Only image files can be uploaded.");
      return;
    }
    setIsUploading(true);
    const result = await uploadMediaFiles(files);
    setIsUploading(false);
    if (result.ok) {
      setError(null);
      setNotice(`Uploaded ${files.length} image${files.length === 1 ? "" : "s"}.`);
      router.refresh();
    } else {
      setError(result.error ?? "Upload failed.");
    }
  }

  const isFiltered = Boolean(filter.q || filter.folder || filter.usage !== "all");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`Permanently delete ${ids.length} image${ids.length === 1 ? "" : "s"}? This also removes the file from storage and can't be undone. Images still in use will be skipped.`)) return;

    startTransition(async () => {
      const result = await deleteMediaAssets(ids);
      setError(result?.error ?? null);
      setNotice(result?.deleted ? `Deleted ${result.deleted} image${result.deleted === 1 ? "" : "s"}.` : null);
      setSelected(new Set());
    });
  }

  return (
    // Drop handling lives on the whole library rather than a small target: dragging a file
    // at a narrow strip is fiddly, and the obvious gesture is "drop it on the grid".
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragging) setIsDragging(true);
      }}
      // dragleave fires when crossing onto a child element too, so only clear when the
      // pointer has actually left the container — otherwise the overlay flickers constantly.
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) void handleDroppedFiles(e.dataTransfer.files);
      }}
      className={isDragging ? "outline-2 outline-offset-4 outline-luxe-black" : undefined}
    >
      {isDragging || isUploading ? (
        <p className="mb-3 flex items-center gap-2 border border-dashed border-luxe-black bg-luxe-gray-light/40 p-4 text-sm">
          <Upload className="size-4" strokeWidth={1.5} />
          {isUploading ? "Uploading…" : "Drop images to upload"}
        </p>
      ) : null}

      <ListFilterBar
        action="/admin/media"
        searchValue={filter.q}
        searchPlaceholder="Search filename, alt text or tag"
        selects={[
          {
            name: "folder",
            label: "All folders",
            value: filter.folder ?? "",
            options: folders.map((f) => ({ value: f, label: f })),
          },
          {
            name: "usage",
            label: "All images",
            value: filter.usage === "all" ? "" : filter.usage,
            options: [
              { value: "used", label: "In use" },
              { value: "unused", label: "Unused" },
            ],
          },
        ]}
      />

      {error ? <p className="mb-3 border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="mb-3 border border-border bg-luxe-gray-light/40 p-3 text-sm">{notice}</p> : null}

      {selected.size > 0 ? (
        <div className="mb-3 space-y-2 border border-luxe-black bg-luxe-gray-light/40 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <input
              value={bulkFolder}
              onChange={(e) => setBulkFolder(e.target.value)}
              placeholder="Move to folder…"
              aria-label="Move selected to folder"
              className="h-8 w-40 border border-border bg-transparent px-2 text-xs outline-none focus:border-luxe-black"
            />
            <input
              value={bulkTags}
              onChange={(e) => setBulkTags(e.target.value)}
              placeholder="Add tags…"
              aria-label="Add tags to selected"
              className="h-8 w-40 border border-border bg-transparent px-2 text-xs outline-none focus:border-luxe-black"
            />
            <button
              type="button"
              disabled={isPending || (!bulkFolder.trim() && !bulkTags.trim())}
              onClick={() =>
                startTransition(async () => {
                  const result = await bulkOrganiseMedia([...selected], { folder: bulkFolder, addTags: bulkTags });
                  setError(result?.error ?? null);
                  if (!result?.error) {
                    setNotice(`Updated ${result.updated} image${result.updated === 1 ? "" : "s"}.`);
                    setBulkFolder("");
                    setBulkTags("");
                    setSelected(new Set());
                  }
                })
              }
              className="h-8 border border-luxe-black px-3 text-xs font-medium tracking-[0.05em] uppercase disabled:opacity-50"
            >
              Apply
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {canDelete ? (
              <button
                type="button"
                onClick={runDelete}
                disabled={isPending}
                className="h-8 border border-destructive px-3 text-xs font-medium tracking-[0.05em] text-destructive uppercase disabled:opacity-50"
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            ) : (
              <span className="flex items-center gap-1 text-xs text-luxe-gray-dark">
                <Lock className="size-3.5" strokeWidth={1.5} /> Your role can&apos;t delete media
              </span>
            )}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="h-8 border border-luxe-black px-3 text-xs font-medium tracking-[0.05em] uppercase"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {assets.length === 0 ? (
        <p className="border border-border bg-luxe-white p-10 text-center text-sm text-luxe-gray-dark">
          {isFiltered ? "No images match these filters." : "No images yet."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {assets.map((asset) => (
            <MediaTile
              key={asset.id}
              asset={asset}
              selected={selected.has(asset.id)}
              onToggle={() => toggle(asset.id)}
              onEdit={() => setEditing(asset)}
            />
          ))}
        </div>
      )}

      <Pagination
        basePath="/admin/media"
        params={{ q: filter.q, folder: filter.folder, usage: filter.usage === "all" ? undefined : filter.usage }}
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={PAGE_SIZE}
        label="images"
      />

      {editing ? <EditPanel asset={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

/**
 * Renders a stored image URL two different ways on purpose.
 *
 * `next/image` throws a fatal, route-killing error for any hostname missing from
 * remotePatterns — a single legacy or mistyped URL would blank the entire library. But
 * dropping to a plain <img> for everything would mean pulling ~318 full-size photos to
 * fill 200px tiles. So: optimise the hosts the optimizer actually accepts, and let
 * anything else degrade to one broken thumbnail instead of a broken page.
 */
export function AssetThumb({
  asset,
  contain,
  sizes = "200px",
}: {
  asset: MediaAssetWithUsage;
  contain?: boolean;
  sizes?: string;
}) {
  const alt = asset.altText ?? asset.filename;
  const fit = contain ? "object-contain" : "object-cover";

  if (isOptimizableImageUrl(asset.url)) {
    return <Image src={asset.url} alt={alt} fill sizes={sizes} className={fit} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- unconfigured host; see above.
    <img src={asset.url} alt={alt} loading="lazy" className={`size-full ${fit}`} />
  );
}

function MediaTile({
  asset,
  selected,
  onToggle,
  onEdit,
}: {
  asset: MediaAssetWithUsage;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className={`border bg-luxe-white ${selected ? "border-luxe-black" : "border-border"}`}>
      <div className="relative aspect-square overflow-hidden bg-luxe-gray-light">
        <AssetThumb asset={asset} />
        <label className="absolute top-2 left-2 flex size-6 cursor-pointer items-center justify-center bg-luxe-white/90">
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${asset.filename}`} />
        </label>
        {asset.usage.length > 0 ? (
          <span className="absolute right-2 bottom-2 bg-luxe-black/80 px-1.5 py-0.5 text-[10px] tracking-[0.05em] text-luxe-white uppercase">
            In use
          </span>
        ) : null}
      </div>
      <div className="p-2">
        <p className="truncate text-xs" title={asset.filename}>
          {asset.filename}
        </p>
        <p className="text-[10px] text-luxe-gray-dark">
          {asset.folder ?? "—"} · {formatSize(asset.sizeBytes)}
        </p>
        <div className="mt-1.5 flex gap-2">
          <button type="button" onClick={onEdit} className="text-[10px] font-medium tracking-[0.05em] uppercase">
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(asset.url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex items-center gap-1 text-[10px] font-medium tracking-[0.05em] text-luxe-gray-dark uppercase"
          >
            {copied ? <Check className="size-3" strokeWidth={2} /> : <Copy className="size-3" strokeWidth={1.5} />}
            {copied ? "Copied" : "URL"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPanel({ asset, onClose }: { asset: MediaAssetWithUsage; onClose: () => void }) {
  const [altText, setAltText] = useState(asset.altText ?? "");
  const [folder, setFolder] = useState(asset.folder ?? "");
  const [tags, setTags] = useState(asset.tags.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateMediaDetails(asset.id, { altText, folder, tags });
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`Edit ${asset.filename}`}>
      <div className="max-h-full w-full max-w-lg overflow-y-auto border border-border bg-luxe-white p-6">
        <h3 className="mb-1 text-sm font-medium tracking-[0.05em] uppercase">{asset.filename}</h3>
        <p className="mb-4 text-xs text-luxe-gray-dark">
          {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}
          {formatSize(asset.sizeBytes)} · {asset.contentType ?? "unknown type"}
        </p>

        <div className="relative mb-4 aspect-video overflow-hidden bg-luxe-gray-light">
          <AssetThumb asset={asset} contain sizes="500px" />
        </div>

        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-eyebrow" htmlFor="ml-alt">Default alt text</label>
            <input id="ml-alt" value={altText} onChange={(e) => setAltText(e.target.value)} className="h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black" />
            <p className="mt-1 text-xs text-luxe-gray-dark">Offered when attaching this image. Each product keeps its own alt text.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-eyebrow" htmlFor="ml-folder">Folder</label>
            <input id="ml-folder" value={folder} onChange={(e) => setFolder(e.target.value)} className="h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black" />
          </div>
          <div>
            <label className="mb-1.5 block text-eyebrow" htmlFor="ml-tags">Tags</label>
            <input id="ml-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="campaign, autumn" className="h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black" />
            <p className="mt-1 text-xs text-luxe-gray-dark">Comma-separated.</p>
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <p className="text-eyebrow mb-1.5">Used by</p>
          {asset.usage.length === 0 ? (
            <p className="text-xs text-luxe-gray-dark">Not used anywhere — safe to delete.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {asset.usage.map((u) => (
                <li key={u.label}>
                  {u.href ? (
                    <Link href={u.href} className="hover:underline">
                      {u.label}
                    </Link>
                  ) : (
                    u.label
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 border border-border px-4 text-xs font-medium tracking-[0.05em] uppercase">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={isPending} className="h-10 bg-luxe-black px-5 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase disabled:opacity-50">
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
