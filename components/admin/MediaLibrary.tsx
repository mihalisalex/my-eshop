"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { isOptimizableImageUrl } from "@/lib/image-hosts";
import { Check, Copy, Lock } from "lucide-react";
import { deleteMediaAssets, updateMediaDetails } from "@/app/admin/(dashboard)/media/actions";
import type { MediaAssetWithUsage } from "@/types/media";

interface MediaLibraryProps {
  assets: MediaAssetWithUsage[];
  folders: string[];
  canDelete: boolean;
}

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaLibrary({ assets, folders, canDelete }: MediaLibraryProps) {
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("all");
  const [usageFilter, setUsageFilter] = useState<"all" | "used" | "unused">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<MediaAssetWithUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (folder !== "all" && (a.folder ?? "") !== folder) return false;
      if (usageFilter === "used" && a.usage.length === 0) return false;
      if (usageFilter === "unused" && a.usage.length > 0) return false;
      if (!needle) return true;
      return (
        a.filename.toLowerCase().includes(needle) ||
        (a.altText?.toLowerCase().includes(needle) ?? false) ||
        a.tags.some((t) => t.toLowerCase().includes(needle))
      );
    });
  }, [assets, query, folder, usageFilter]);

  const unusedCount = assets.filter((a) => a.usage.length === 0).length;

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
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search filename, alt text or tag…"
          aria-label="Search media"
          className="h-9 min-w-56 flex-1 border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black"
        />
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          aria-label="Filter by folder"
          className="h-9 border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black"
        >
          <option value="all">All folders</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          value={usageFilter}
          onChange={(e) => setUsageFilter(e.target.value as "all" | "used" | "unused")}
          aria-label="Filter by usage"
          className="h-9 border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black"
        >
          <option value="all">All images</option>
          <option value="used">In use</option>
          <option value="unused">Unused ({unusedCount})</option>
        </select>
      </div>

      {error ? <p className="mb-3 border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="mb-3 border border-border bg-luxe-gray-light/40 p-3 text-sm">{notice}</p> : null}

      {selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 border border-luxe-black bg-luxe-gray-light/40 px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
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

      <p className="mb-2 text-xs text-luxe-gray-dark">
        {visible.length} of {assets.length} images
      </p>

      {visible.length === 0 ? (
        <p className="border border-border bg-luxe-white p-10 text-center text-sm text-luxe-gray-dark">
          No images match these filters.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visible.map((asset) => (
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
function AssetThumb({
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
