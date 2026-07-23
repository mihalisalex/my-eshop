"use client";

import Image from "next/image";
import { IdChipList } from "@/components/admin/homepage-editor/IdChipList";
import type { HomepageSection } from "@/types";

interface SectionEditFormProps {
  section: HomepageSection;
  onChange: (next: HomepageSection) => void;
}

const inputClass = "h-10 w-full border border-border px-3 text-sm outline-none focus:border-luxe-black";
const textareaClass = "w-full border border-border px-3 py-2 text-sm outline-none focus:border-luxe-black";
const labelClass = "mb-1 block text-xs font-medium text-luxe-gray-dark uppercase";

/** Renders the right fields for whichever homepage section type is being edited. */
export function SectionEditForm({ section, onChange }: SectionEditFormProps) {
  switch (section.type) {
    case "hero":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Eyebrow" value={section.data.eyebrow ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, eyebrow: v } })} />
            <Field label="Subheadline" value={section.data.subheadline ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, subheadline: v } })} />
          </div>
          <TextAreaField label="Headline" value={section.data.headline} onChange={(v) => onChange({ ...section, data: { ...section.data, headline: v } })} />
          <ImageField src={section.data.image.src} alt={section.data.image.alt} onChangeSrc={(v) => onChange({ ...section, data: { ...section.data, image: { ...section.data.image, src: v } } })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Primary CTA Label" value={section.data.primaryCta?.label ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, primaryCta: { label: v, href: section.data.primaryCta?.href ?? "/" } } })} />
            <Field label="Primary CTA Link" value={section.data.primaryCta?.href ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, primaryCta: { label: section.data.primaryCta?.label ?? "", href: v } } })} />
            <Field label="Secondary CTA Label" value={section.data.secondaryCta?.label ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, secondaryCta: { label: v, href: section.data.secondaryCta?.href ?? "/" } } })} />
            <Field label="Secondary CTA Link" value={section.data.secondaryCta?.href ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, secondaryCta: { label: section.data.secondaryCta?.label ?? "", href: v } } })} />
          </div>
        </div>
      );

    case "featuredCollections":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title" value={section.data.title} onChange={(v) => onChange({ ...section, data: { ...section.data, title: v } })} />
            <Field label="Subtitle" value={section.data.subtitle ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, subtitle: v } })} />
          </div>
          <IdChipList label="Collections" ids={section.data.collectionIds} onChange={(ids) => onChange({ ...section, data: { ...section.data, collectionIds: ids } })} />
        </div>
      );

    case "bestSellers":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title" value={section.data.title} onChange={(v) => onChange({ ...section, data: { ...section.data, title: v } })} />
            <Field label="Subtitle" value={section.data.subtitle ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, subtitle: v } })} />
          </div>
          <Field label="View All CTA Label" value={section.data.viewAllCta?.label ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, viewAllCta: { label: v, href: section.data.viewAllCta?.href ?? "/" } } })} />
          <IdChipList label="Products" ids={section.data.productIds} onChange={(ids) => onChange({ ...section, data: { ...section.data, productIds: ids } })} />
        </div>
      );

    case "newArrivals":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title" value={section.data.title} onChange={(v) => onChange({ ...section, data: { ...section.data, title: v } })} />
            <Field label="Subtitle" value={section.data.subtitle ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, subtitle: v } })} />
          </div>
          <IdChipList label="Products" ids={section.data.productIds} onChange={(ids) => onChange({ ...section, data: { ...section.data, productIds: ids } })} />
        </div>
      );

    case "editorialBanner":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Eyebrow" value={section.data.eyebrow ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, eyebrow: v } })} />
            <div>
              <label className={labelClass}>Image Position</label>
              <select
                value={section.data.imagePosition ?? "right"}
                onChange={(e) => onChange({ ...section, data: { ...section.data, imagePosition: e.target.value as "left" | "right" } })}
                className={inputClass}
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
          <Field label="Headline" value={section.data.headline} onChange={(v) => onChange({ ...section, data: { ...section.data, headline: v } })} />
          <TextAreaField label="Body" value={section.data.body ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, body: v } })} />
          <ImageField src={section.data.image.src} alt={section.data.image.alt} onChangeSrc={(v) => onChange({ ...section, data: { ...section.data, image: { ...section.data.image, src: v } } })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="CTA Label" value={section.data.cta?.label ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, cta: { label: v, href: section.data.cta?.href ?? "/" } } })} />
            <Field label="CTA Link" value={section.data.cta?.href ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, cta: { label: section.data.cta?.label ?? "", href: v } } })} />
          </div>
        </div>
      );

    case "brandStory":
      return (
        <div className="space-y-4">
          <Field label="Eyebrow" value={section.data.eyebrow ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, eyebrow: v } })} />
          <Field label="Headline" value={section.data.headline} onChange={(v) => onChange({ ...section, data: { ...section.data, headline: v } })} />
          <TextAreaField label="Body" value={section.data.body} onChange={(v) => onChange({ ...section, data: { ...section.data, body: v } })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="CTA Label" value={section.data.cta?.label ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, cta: { label: v, href: section.data.cta?.href ?? "/" } } })} />
            <Field label="CTA Link" value={section.data.cta?.href ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, cta: { label: section.data.cta?.label ?? "", href: v } } })} />
          </div>
        </div>
      );

    case "socialGrid":
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Title" value={section.data.title} onChange={(v) => onChange({ ...section, data: { ...section.data, title: v } })} />
          <Field label="Handle" value={section.data.handle ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, handle: v } })} />
        </div>
      );

    case "newsletter":
      return (
        <div className="space-y-4">
          <Field label="Headline" value={section.data.headline} onChange={(v) => onChange({ ...section, data: { ...section.data, headline: v } })} />
          <Field label="Subheadline" value={section.data.subheadline ?? ""} onChange={(v) => onChange({ ...section, data: { ...section.data, subheadline: v } })} />
          <Field label="CTA Label" value={section.data.ctaLabel} onChange={(v) => onChange({ ...section, data: { ...section.data, ctaLabel: v } })} />
        </div>
      );

    default:
      return null;
  }
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={textareaClass} />
    </div>
  );
}

function ImageField({ src, alt, onChangeSrc }: { src: string; alt: string; onChangeSrc: (v: string) => void }) {
  return (
    <div>
      <label className={labelClass}>Image</label>
      <div className="flex items-center gap-3">
        <div className="relative size-16 shrink-0 overflow-hidden border border-border bg-luxe-gray-light">
          <Image src={src} alt={alt} fill sizes="64px" className="object-cover" />
        </div>
        <input
          value={src}
          onChange={(e) => onChangeSrc(e.target.value)}
          placeholder="Image URL"
          className={inputClass}
        />
      </div>
    </div>
  );
}
