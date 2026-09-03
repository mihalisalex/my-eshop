"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AssetThumb } from "@/components/admin/MediaLibrary";
import type { MediaAssetWithUsage } from "@/types/media";
import type { AdminMediaList } from "@/services/media";

interface MediaLibraryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once with every asset chosen — the caller decides what each becomes (an
   *  image row, an alt text, whatever the context needs). */
  onSelect: (assets: MediaAssetWithUsage[]) => void;
}

/**
 * Choosing an existing photo instead of uploading a new one.
 *
 * Before this, attaching a photo to a product meant either uploading it fresh — even when
 * it was already sitting in the library from an earlier upload or another product's shoot —
 * or leaving the admin, opening the Media Library in another tab, copying a URL by hand, and
 * pasting it into the URL fallback field. Neither is what "choose files" implies once a
 * library already exists.
 *
 * A modal rather than a second page: the product form is mid-edit, and navigating away to
 * browse the library would mean losing whatever else was typed but not yet saved.
 */
export function MediaLibraryPicker({ open, onOpenChange, onSelect }: MediaLibraryPickerProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AdminMediaList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const requestId = useRef(0);

  // Fresh every time it opens — a stale search or a stale selection from last time this
  // modal was used would be confusing to land on.
  useEffect(() => {
    if (!open) return;
    // Resetting a dialog's own state when it opens has no external system to synchronise
    // with instead, the same reasoning WishlistProvider's load effect disables this for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    setPage(1);
    setSelected(new Set());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    // This effect's entire job is starting a fetch and tracking its lifecycle; there is no
    // external system to defer the loading/error flags to.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: String(page) });
    if (query.trim()) params.set("q", query.trim());

    // Debounced: a search box that fires one request per keystroke against every open of
    // this modal would be the single busiest read in the admin.
    const timer = setTimeout(() => {
      fetch(`/api/admin/media?${params}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((data: AdminMediaList) => {
          if (requestId.current === id) setResult(data);
        })
        .catch(() => {
          if (requestId.current === id) setError("Could not load the media library.");
        })
        .finally(() => {
          if (requestId.current === id) setLoading(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [open, query, page]);

  function toggle(asset: MediaAssetWithUsage) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(asset.id)) next.delete(asset.id);
      else next.add(asset.id);
      return next;
    });
  }

  function confirm() {
    if (!result) return;
    const chosen = result.rows.filter((asset) => selected.has(asset.id));
    onSelect(chosen);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col rounded-none border-none p-0">
        <div className="border-b border-border p-5">
          <DialogTitle className="font-heading text-xl">Choose from Media Library</DialogTitle>
          <div className="relative mt-3">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-luxe-gray-dark" strokeWidth={1.5} />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by filename, alt text, or tag…"
              className="h-10 w-full border border-border bg-transparent pr-3 pl-9 text-sm outline-none focus:border-luxe-black"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : loading && !result ? (
            <div className="flex items-center justify-center py-16 text-luxe-gray-dark">
              <Loader2 className="size-5 animate-spin" strokeWidth={1.5} />
            </div>
          ) : result && result.rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-luxe-gray-dark">
              {query ? "No images match that search." : "The Media Library is empty."}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {result?.rows.map((asset) => {
                const isSelected = selected.has(asset.id);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => toggle(asset)}
                    className={`group relative aspect-3/4 overflow-hidden border bg-luxe-gray-light text-left ${
                      isSelected ? "border-luxe-black" : "border-border"
                    }`}
                  >
                    <AssetThumb asset={asset} sizes="200px" />
                    <div
                      className={`absolute top-2 left-2 flex size-5 items-center justify-center border ${
                        isSelected ? "border-luxe-black bg-luxe-black text-luxe-white" : "border-luxe-white bg-luxe-white/80"
                      }`}
                    >
                      {isSelected ? <Check className="size-3.5" strokeWidth={2} /> : null}
                    </div>
                    <p className="absolute inset-x-0 bottom-0 truncate bg-luxe-white/90 px-1.5 py-1 text-[10px]">
                      {asset.filename}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border p-5">
          <div className="flex items-center gap-2 text-xs text-luxe-gray-dark">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex size-8 items-center justify-center border border-border disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </button>
            <span className="tabular-nums">
              {result ? `Page ${result.page} of ${Math.max(1, result.pageCount)}` : "—"}
            </span>
            <button
              type="button"
              disabled={!result || page >= result.pageCount || loading}
              onClick={() => setPage((p) => p + 1)}
              className="flex size-8 items-center justify-center border border-border disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </button>
          </div>

          <button
            type="button"
            disabled={selected.size === 0}
            onClick={confirm}
            className="h-10 bg-luxe-black px-6 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase disabled:opacity-40"
          >
            {selected.size === 0 ? "Select photos" : `Add ${selected.size} photo${selected.size === 1 ? "" : "s"}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
