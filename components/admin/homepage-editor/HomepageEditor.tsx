"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, Eye, GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SectionEditForm } from "@/components/admin/homepage-editor/SectionEditForm";
import { cn } from "@/lib/utils";
import type { HomepageSection } from "@/types";

interface HomepageEditorProps {
  /** The FULL homepage section list, always — even on the Hero Management page (see focusSectionId), so a save there can never silently drop every other section. */
  initialSections: HomepageSection[];
  /** When set, only this section is shown, expanded, with no reordering — used by the Hero Management page. */
  focusSectionId?: string;
  onPublish: (sections: HomepageSection[]) => Promise<void>;
}

const SECTION_LABELS: Record<HomepageSection["type"], string> = {
  hero: "Hero",
  featuredCollections: "Featured Collections",
  bestSellers: "Best Sellers",
  editorialBanner: "Editorial Banner",
  newArrivals: "New Arrivals",
  brandStory: "Brand Story",
  socialGrid: "Social Grid",
  brandStrip: "Brands",
  newsletter: "Newsletter",
};

function summarize(section: HomepageSection): string {
  switch (section.type) {
    case "hero":
      return section.data.headline.replace("\n", " ");
    case "featuredCollections":
    case "bestSellers":
    case "newArrivals":
    case "socialGrid":
      return section.data.title;
    case "brandStrip":
      return section.data.brands.map((b) => b.name).join(", ");
    case "editorialBanner":
    case "brandStory":
      return section.data.headline;
    case "newsletter":
      return section.data.headline;
    default:
      return "";
  }
}

export function HomepageEditor({ initialSections, focusSectionId, onPublish }: HomepageEditorProps) {
  const [sections, setSections] = useState(
    [...initialSections].sort((a, b) => a.order - b.order)
  );
  const [expandedId, setExpandedId] = useState<string | null>(focusSectionId ?? null);
  const [status, setStatus] = useState<"idle" | "published" | "error">("idle");
  const [isPending, startTransition] = useTransition();
  const dragIndex = useRef<number | null>(null);

  const visibleSections = focusSectionId
    ? sections.filter((s) => s.id === focusSectionId)
    : sections;

  const updateSection = (updated: HomepageSection) => {
    setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setStatus("idle");
  };

  const toggleEnabled = (id: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
    setStatus("idle");
  };

  const handleDrop = (targetIndex: number) => {
    const fromIndex = dragIndex.current;
    dragIndex.current = null;
    if (fromIndex === null || fromIndex === targetIndex) return;

    setSections((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next.map((section, index) => ({ ...section, order: index }));
    });
    setStatus("idle");
  };

  const handlePublish = () => {
    startTransition(async () => {
      try {
        await onPublish(sections);
        setStatus("published");
      } catch {
        setStatus("error");
      }
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between border border-border bg-luxe-white p-4">
        <p className="text-sm text-luxe-gray-dark">
          {focusSectionId
            ? "Changes here publish immediately to the live homepage."
            : "Drag rows to reorder. Changes publish immediately to the live homepage."}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            target="_blank"
            className="flex h-9 items-center gap-1.5 border border-border px-4 text-xs font-medium tracking-[0.05em] uppercase"
          >
            <Eye className="size-3.5" strokeWidth={1.5} />
            Preview
          </Link>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPending}
            className="h-9 bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase disabled:opacity-50"
          >
            {isPending ? "Publishing..." : "Publish Changes"}
          </button>
        </div>
      </div>

      {status !== "idle" ? (
        <p className={cn("mb-4 text-xs", status === "published" ? "text-green-700" : "text-destructive")}>
          {status === "published" ? "Published — live on the storefront now." : "Couldn't publish. Try again."}
        </p>
      ) : null}

      <div className="divide-y divide-border border border-border bg-luxe-white">
        {visibleSections.map((section, index) => {
          const expanded = expandedId === section.id;
          return (
            <div key={section.id}>
              <div
                draggable={!focusSectionId}
                onDragStart={() => {
                  dragIndex.current = sections.findIndex((s) => s.id === section.id);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(sections.findIndex((s) => s.id === section.id))}
                className={cn(
                  "flex items-center gap-3 p-4",
                  !focusSectionId && "cursor-grab active:cursor-grabbing"
                )}
              >
                {!focusSectionId ? (
                  <GripVertical className="size-4 shrink-0 text-luxe-gray-dark" strokeWidth={1.5} />
                ) : null}
                <span className="w-8 shrink-0 text-xs text-luxe-gray-dark">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="border border-border px-1.5 py-0.5 text-[10px] font-medium tracking-[0.05em] uppercase">
                      {SECTION_LABELS[section.type]}
                    </span>
                    <p className="truncate text-sm">{summarize(section)}</p>
                  </div>
                </div>
                <Switch checked={section.enabled} onCheckedChange={() => toggleEnabled(section.id)} />
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : section.id)}
                  aria-label={expanded ? "Collapse" : "Expand"}
                  className="flex size-8 items-center justify-center"
                >
                  <ChevronDown
                    className={cn("size-4 transition-transform", expanded && "rotate-180")}
                    strokeWidth={1.5}
                  />
                </button>
              </div>
              {expanded ? (
                <div className="border-t border-border bg-luxe-gray-light/40 p-5">
                  <SectionEditForm section={section} onChange={updateSection} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
