"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { SiteSeoDefaults } from "@/types";

interface SeoSettingsFormProps {
  initialSeo: SiteSeoDefaults;
  onSave: (seo: SiteSeoDefaults) => Promise<void>;
}

export function SeoSettingsForm({ initialSeo, onSave }: SeoSettingsFormProps) {
  const [seo, setSeo] = useState(initialSeo);
  const [saved, setSaved] = useState<"idle" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  const field = (key: keyof SiteSeoDefaults, value: string) => {
    setSeo((prev) => ({ ...prev, [key]: value }));
    setSaved("idle");
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        await onSave(seo);
        setSaved("saved");
      } catch {
        setSaved("error");
      }
    });
  };

  return (
    <div className="max-w-2xl border border-border bg-luxe-white p-6">
      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-luxe-gray-dark uppercase">Default Title</label>
          <input
            value={seo.defaultTitle}
            onChange={(e) => field("defaultTitle", e.target.value)}
            className="h-10 w-full border border-border px-3 text-sm outline-none focus:border-luxe-black"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-luxe-gray-dark uppercase">Title Template</label>
          <input
            value={seo.titleTemplate}
            onChange={(e) => field("titleTemplate", e.target.value)}
            className="h-10 w-full border border-border px-3 text-sm outline-none focus:border-luxe-black"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-luxe-gray-dark uppercase">
            Default Meta Description
          </label>
          <textarea
            value={seo.defaultDescription}
            onChange={(e) => field("defaultDescription", e.target.value)}
            rows={3}
            className="w-full border border-border px-3 py-2 text-sm outline-none focus:border-luxe-black"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-luxe-gray-dark uppercase">Site URL</label>
          <input
            value={seo.siteUrl}
            onChange={(e) => field("siteUrl", e.target.value)}
            className="h-10 w-full border border-border px-3 text-sm outline-none focus:border-luxe-black"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-luxe-gray-dark uppercase">Twitter Handle</label>
          <input
            value={seo.twitterHandle ?? ""}
            onChange={(e) => field("twitterHandle", e.target.value)}
            className="h-10 w-full border border-border px-3 text-sm outline-none focus:border-luxe-black"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
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
