"use client";

import { useState, useTransition } from "react";
import { Check, Plus, X, AlertTriangle } from "lucide-react";
import { REMOTE_IMAGE_HOSTS, isOptimizableImageUrl } from "@/lib/image-hosts";
import type { NavigationConfig, NavItem } from "@/types";

/** One entry in a header item's dropdown promo panel. */
type Featured = NonNullable<NavItem["featured"]>[number];

interface NavigationEditorProps {
  /** The FULL navigation config, always — this editor only touches .primary (including each item's .children — the header's dropdown sub-menus), but a save must round-trip .utility/.footer unchanged rather than dropping them. */
  initialNavigation: NavigationConfig;
  onSave: (navigation: NavigationConfig) => Promise<void>;
}

const inputClass = "h-10 w-full border border-border px-3 text-sm outline-none focus:border-luxe-black";
const labelClass = "mb-1 block text-xs font-medium text-luxe-gray-dark uppercase";

function newChild(): NavItem {
  return { id: crypto.randomUUID(), label: "", href: "" };
}

function newFeatured(): Featured {
  return { title: "", image: "", href: "" };
}

/**
 * Read off the same array `next.config.ts` builds `images.remotePatterns` from, so this hint
 * cannot drift from what the optimizer actually accepts.
 */
const ALLOWED_HOSTS = REMOTE_IMAGE_HOSTS.map((host) => host.hostname).join(", ");

export function NavigationEditor({ initialNavigation, onSave }: NavigationEditorProps) {
  const [navigation, setNavigation] = useState(initialNavigation);
  const [saved, setSaved] = useState<"idle" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  const updateItem = (id: string, patch: Partial<NavItem>) => {
    setNavigation((prev) => ({
      ...prev,
      primary: prev.primary.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
    setSaved("idle");
  };

  const updateChild = (parentId: string, childId: string, patch: Partial<NavItem>) => {
    setNavigation((prev) => ({
      ...prev,
      primary: prev.primary.map((item) =>
        item.id === parentId
          ? { ...item, children: (item.children ?? []).map((child) => (child.id === childId ? { ...child, ...patch } : child)) }
          : item
      ),
    }));
    setSaved("idle");
  };

  const addChild = (parentId: string) => {
    setNavigation((prev) => ({
      ...prev,
      primary: prev.primary.map((item) =>
        item.id === parentId ? { ...item, children: [...(item.children ?? []), newChild()] } : item
      ),
    }));
    setSaved("idle");
  };

  /**
   * Featured entries have no id of their own — they are a plain array on the item — so these
   * address them by index. Fine because nothing reorders them; if drag-ordering is ever added
   * here, give them ids first.
   */
  const updateFeatured = (itemId: string, index: number, patch: Partial<Featured>) => {
    setNavigation((prev) => ({
      ...prev,
      primary: prev.primary.map((item) =>
        item.id === itemId
          ? { ...item, featured: (item.featured ?? []).map((f, i) => (i === index ? { ...f, ...patch } : f)) }
          : item
      ),
    }));
    setSaved("idle");
  };

  const addFeatured = (itemId: string) => {
    setNavigation((prev) => ({
      ...prev,
      primary: prev.primary.map((item) =>
        item.id === itemId ? { ...item, featured: [...(item.featured ?? []), newFeatured()] } : item
      ),
    }));
    setSaved("idle");
  };

  const removeFeatured = (itemId: string, index: number) => {
    setNavigation((prev) => ({
      ...prev,
      primary: prev.primary.map((item) =>
        item.id === itemId ? { ...item, featured: (item.featured ?? []).filter((_, i) => i !== index) } : item
      ),
    }));
    setSaved("idle");
  };

  const removeChild = (parentId: string, childId: string) => {
    setNavigation((prev) => ({
      ...prev,
      primary: prev.primary.map((item) =>
        item.id === parentId ? { ...item, children: (item.children ?? []).filter((child) => child.id !== childId) } : item
      ),
    }));
    setSaved("idle");
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        await onSave(navigation);
        setSaved("saved");
      } catch {
        setSaved("error");
      }
    });
  };

  return (
    <div className="border border-border bg-luxe-white">
      <div className="divide-y divide-border">
        {navigation.primary.map((item) => (
          <div key={item.id} className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Label</label>
                <input
                  value={item.label}
                  onChange={(e) => updateItem(item.id, { label: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Link</label>
                <input
                  value={item.href}
                  onChange={(e) => updateItem(item.id, { href: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="border-t border-border pt-3 pl-4">
              <p className="mb-2 text-xs font-medium text-luxe-gray-dark uppercase">
                Dropdown items {item.children?.length ? `(${item.children.length})` : ""}
              </p>
              <div className="space-y-2">
                {(item.children ?? []).map((child) => (
                  <div key={child.id} className="flex items-start gap-2">
                    <input
                      value={child.label}
                      onChange={(e) => updateChild(item.id, child.id, { label: e.target.value })}
                      placeholder="Label"
                      className={inputClass}
                    />
                    <input
                      value={child.href}
                      onChange={(e) => updateChild(item.id, child.id, { href: e.target.value })}
                      placeholder="Link"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${child.label || "dropdown item"}`}
                      onClick={() => removeChild(item.id, child.id)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center text-luxe-gray-dark transition-colors hover:text-destructive"
                    >
                      <X className="size-4" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => addChild(item.id)}
                className="mt-2 flex items-center gap-1.5 text-xs text-luxe-gray-dark hover:text-luxe-black"
              >
                <Plus className="size-3.5" strokeWidth={1.5} />
                Add dropdown item
              </button>
            </div>

            <div className="border-t border-border pt-3 pl-4">
              <p className="mb-1 text-xs font-medium text-luxe-gray-dark uppercase">
                Dropdown promo images {item.featured?.length ? `(${item.featured.length})` : ""}
              </p>
              <p className="mb-3 text-xs text-luxe-gray-dark">
                The large pictures on the right of this menu&apos;s dropdown. Upload in Media, then paste
                the URL here. Allowed hosts: <span className="font-mono">{ALLOWED_HOSTS}</span>.
              </p>

              <div className="space-y-3">
                {(item.featured ?? []).map((feature, index) => {
                  const usable = feature.image === "" || isOptimizableImageUrl(feature.image);
                  return (
                    <div key={index} className="flex items-start gap-3 border border-border p-3">
                      {/* Plain <img>, not next/image: this renders whatever URL is in the box, and
                          next/image throws a fatal error on an unconfigured host rather than
                          degrading — it would take the admin page down mid-edit. */}
                      {feature.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={feature.image}
                          alt=""
                          className="h-20 w-16 shrink-0 border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-16 shrink-0 items-center justify-center border border-dashed border-border text-[10px] text-luxe-gray-dark">
                          No image
                        </div>
                      )}

                      <div className="grid min-w-0 flex-1 gap-2">
                        <input
                          value={feature.title}
                          onChange={(e) => updateFeatured(item.id, index, { title: e.target.value })}
                          placeholder="Caption shown over the image"
                          className={inputClass}
                        />
                        <input
                          value={feature.image}
                          onChange={(e) => updateFeatured(item.id, index, { image: e.target.value })}
                          placeholder="Image URL"
                          aria-invalid={!usable}
                          className={inputClass}
                        />
                        {!usable ? (
                          <p className="flex items-start gap-1.5 text-xs text-destructive">
                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.5} />
                            This host is not allowed, so the image will not render on the storefront.
                          </p>
                        ) : null}
                        <input
                          value={feature.href}
                          onChange={(e) => updateFeatured(item.id, index, { href: e.target.value })}
                          placeholder="Link, e.g. /collections/evening-heels"
                          className={inputClass}
                        />
                      </div>

                      <button
                        type="button"
                        aria-label={`Remove promo image ${feature.title || index + 1}`}
                        onClick={() => removeFeatured(item.id, index)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center text-luxe-gray-dark transition-colors hover:text-destructive"
                      >
                        <X className="size-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => addFeatured(item.id)}
                className="mt-2 flex items-center gap-1.5 text-xs text-luxe-gray-dark hover:text-luxe-black"
              >
                <Plus className="size-3.5" strokeWidth={1.5} />
                Add promo image
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-border p-4">
        {saved === "saved" ? (
          <span className="flex items-center gap-1 text-xs text-green-700">
            <Check className="size-3.5" strokeWidth={1.5} />
            Saved
          </span>
        ) : saved === "error" ? (
          <span className="text-xs text-destructive">Couldn&apos;t save. Try again.</span>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="h-9 bg-luxe-black px-5 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
