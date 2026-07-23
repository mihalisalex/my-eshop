"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { NavigationConfig, NavItem } from "@/types";

interface NavigationEditorProps {
  /** The FULL navigation config, always — this editor only touches .primary, but a save must round-trip .utility/.footer unchanged rather than dropping them. */
  initialNavigation: NavigationConfig;
  onSave: (navigation: NavigationConfig) => Promise<void>;
}

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
          <div key={item.id} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-luxe-gray-dark uppercase">Label</label>
              <input
                value={item.label}
                onChange={(e) => updateItem(item.id, { label: e.target.value })}
                className="h-10 w-full border border-border px-3 text-sm outline-none focus:border-luxe-black"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-luxe-gray-dark uppercase">Link</label>
              <input
                value={item.href}
                onChange={(e) => updateItem(item.id, { href: e.target.value })}
                className="h-10 w-full border border-border px-3 text-sm outline-none focus:border-luxe-black"
              />
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
