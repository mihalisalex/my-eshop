"use client";

import { useState } from "react";
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";
import { Plus, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { CategorySeoOverride } from "@/lib/validation/product";
import {
  DESCRIPTION_LENGTH_LIMIT,
  TITLE_LENGTH_LIMIT,
  applyTitleTemplate,
  seoValueOr,
} from "@/lib/seo/resolve";

/**
 * The SEO editor, shared by the product, category and collection forms.
 *
 * It exists because the SEO fields had grown into three near-identical inline blocks, each
 * exposing a different subset — the product form had title and description, the category
 * form had those plus an OG image, and collections had nothing at all. Adding a field meant
 * remembering three places, which is the same drift that let types/product.ts keep a stale
 * duplicate of the override shape.
 *
 * The preview is the point of the component rather than decoration. Every field here is
 * optional, and the honest default for all of them is "leave blank and let the generated
 * value stand" — but nobody can make that judgement without seeing what the generated value
 * IS. So the preview renders the resolved output, template and all, using the same
 * `seoValueOr` the server uses, and the placeholders show the fallbacks as greyed text.
 */

/**
 * Generic over the parent form rather than typed against `any`.
 *
 * `Control<T>` is invariant in react-hook-form, so a concrete `Control<ProductFormValues>`
 * is not assignable to `Control<any>` — the permissive-looking version does not actually
 * compile. Being generic is also the truthful shape: this component reads and writes only
 * `seo.*`, and knows nothing else about the form it sits in.
 *
 * The `as Path<T>` casts below are the cost of that. TypeScript cannot prove an arbitrary
 * `T` has a `seo.title`, and the constraint that would express it ("any form whose `seo`
 * matches CategorySeoOverride") is not something RHF's path types can consume. The three
 * call sites all satisfy it by construction — every form schema here composes the same
 * `categorySeoOverrideSchema` — so the casts are narrowing a real guarantee, not papering
 * over an unknown.
 */
/** The minimal shape this component requires of whatever form it is dropped into. */
type SeoFormShape = { seo: CategorySeoOverride };

interface SeoFieldsetProps<T extends FieldValues> {
  register: UseFormRegister<T>;
  control: Control<T>;
  /** What the storefront would show with no override at all — the generated value. */
  fallbackTitle: string;
  fallbackDescription: string;
  /** Absolute URL of the page being edited, shown in the preview. */
  previewUrl: string;
  /** The site's title template, so the preview shows the real length. */
  titleTemplate: string;
  /** Categories and collections get the editorial fields; products do not. */
  showEditorial?: boolean;
}

const inputClass =
  "h-10 w-full border border-border bg-luxe-white px-3 text-sm focus:border-luxe-black focus:outline-none";
const areaClass = "w-full border border-border bg-luxe-white px-3 py-2 text-sm focus:border-luxe-black focus:outline-none";
const labelClass = "mb-1.5 block text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark";
const hintClass = "mt-1 text-xs text-luxe-gray-dark";

/** Green while there is room, amber once past the point a SERP starts cutting. */
function LengthHint({ value, limit, label }: { value: string; limit: number; label: string }) {
  const over = value.length > limit;
  return (
    <p className={`${hintClass} ${over ? "text-amber-700" : ""}`}>
      {value.length} / {limit} {label}
      {over ? " — likely to be truncated in results" : ""}
    </p>
  );
}

export function SeoFieldset<T extends FieldValues>({
  register,
  control,
  fallbackTitle,
  fallbackDescription,
  previewUrl,
  titleTemplate,
  showEditorial = false,
}: SeoFieldsetProps<T>) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  /** See the note on SeoFieldsetProps for why these casts are sound. */
  const path = (name: string) => name as Path<T>;

  /**
   * The field array is typed against the minimal shape this component actually requires,
   * rather than against `T`. One narrow cast here beats a cast at every `append` — and it
   * states the contract: a parent form must have `seo.faqs`, and nothing else is assumed.
   */
  const faqs = useFieldArray<SeoFormShape>({
    control: control as unknown as Control<SeoFormShape>,
    name: "seo.faqs",
  });

  // `useWatch` rather than the `watch` function: RHF's `watch()` cannot be memoized safely
  // and the React Compiler lint rule flags it. MarginReadout in ProductForm already uses
  // this form for the same reason.
  const titleOverride = useWatch({ control, name: path("seo.title") }) as string | undefined;
  const descriptionOverride = useWatch({ control, name: path("seo.description") }) as string | undefined;
  const ogTitleOverride = useWatch({ control, name: path("seo.ogTitle") }) as string | undefined;
  const ogDescriptionOverride = useWatch({ control, name: path("seo.ogDescription") }) as string | undefined;

  // Resolved exactly as the server will resolve it — same helper, same order.
  const resolvedTitle = seoValueOr(titleOverride, fallbackTitle);
  const resolvedDescription = seoValueOr(descriptionOverride, fallbackDescription);
  const templatedTitle = applyTitleTemplate(resolvedTitle, titleTemplate);

  return (
    <div className="space-y-5">
      {/* The preview leads, because every field below is a decision about whether this is
          good enough — and the templated title is where the surprise usually is. */}
      <div className="border border-border bg-luxe-gray-light/30 p-4">
        <p className="mb-3 text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark">
          Google preview
        </p>
        <div className="max-w-xl">
          <p className="truncate text-xs text-luxe-gray-dark">{previewUrl}</p>
          <p className="mt-0.5 text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{templatedTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-luxe-gray-dark">{resolvedDescription}</p>
        </div>
        <LengthHint value={templatedTitle} limit={TITLE_LENGTH_LIMIT} label="characters, including the site name" />
      </div>

      <div>
        <label className={labelClass} htmlFor="seo-title">Meta title</label>
        <input id="seo-title" className={inputClass} placeholder={fallbackTitle} {...register(path("seo.title"))} />
        <p className={hintClass}>Leave blank to use the name above. The site name is appended automatically.</p>
      </div>

      <div>
        <label className={labelClass} htmlFor="seo-description">Meta description</label>
        <textarea
          id="seo-description"
          rows={3}
          className={areaClass}
          placeholder={fallbackDescription}
          {...register(path("seo.description"))}
        />
        <LengthHint value={resolvedDescription} limit={DESCRIPTION_LENGTH_LIMIT} label="characters" />
      </div>

      {showEditorial ? (
        <>
          <div>
            <label className={labelClass} htmlFor="seo-intro">Introduction shown above the products</label>
            <textarea
              id="seo-intro"
              rows={5}
              className={areaClass}
              placeholder="Real copy about this category — what it holds, who it suits, how it fits. Leave blank if there is nothing useful to say."
              {...register(path("seo.introContent"))}
            />
            <p className={hintClass}>Written for shoppers. Blank is better than filler.</p>
          </div>

          <div>
            <span className={labelClass}>Frequently asked questions</span>
            <p className={`${hintClass} mb-2`}>
              Shown on the page and submitted to Google as FAQ data — so they must be questions real
              customers ask, with answers that are true.
            </p>
            <div className="space-y-2">
              {faqs.fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <input
                      className={inputClass}
                      placeholder="Question"
                      {...register(path(`seo.faqs.${index}.question`))}
                    />
                    <textarea
                      rows={2}
                      className={areaClass}
                      placeholder="Answer"
                      {...register(path(`seo.faqs.${index}.answer`))}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Remove question"
                    onClick={() => faqs.remove(index)}
                    className="flex size-10 shrink-0 items-center justify-center border border-border"
                  >
                    <X className="size-4" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              // Same narrowing as `path` above: the array element is a FAQ by construction,
              // but RHF's FieldArray<T> cannot know that for an unconstrained T.
              onClick={() => faqs.append({ question: "", answer: "" })}
              className="mt-2 flex items-center gap-1 text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark hover:text-luxe-black"
            >
              <Plus className="size-3.5" strokeWidth={1.5} />
              Add question
            </button>
          </div>
        </>
      ) : null}

      {/* Collapsed by default. These four are the ones that can quietly de-index a page or
          point it at the wrong URL, so they should take a deliberate click to reach. */}
      <button
        type="button"
        onClick={() => setShowAdvanced((open) => !open)}
        className="text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark hover:text-luxe-black"
      >
        {showAdvanced ? "Hide" : "Show"} social &amp; indexing options
      </button>

      {showAdvanced ? (
        <div className="space-y-5 border-l-2 border-border pl-4">
          <div>
            <label className={labelClass} htmlFor="seo-og-title">Social share title</label>
            <input id="seo-og-title" className={inputClass} placeholder={resolvedTitle} {...register(path("seo.ogTitle"))} />
            <p className={hintClass}>
              Shown when the page is shared. Falls back to the meta title: “{seoValueOr(ogTitleOverride, resolvedTitle)}”
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="seo-og-description">Social share description</label>
            <textarea
              id="seo-og-description"
              rows={2}
              className={areaClass}
              placeholder={resolvedDescription}
              {...register(path("seo.ogDescription"))}
            />
            <p className={hintClass}>
              Falls back to the meta description: “{seoValueOr(ogDescriptionOverride, resolvedDescription)}”
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="seo-og-image">Social share image URL</label>
            <input id="seo-og-image" className={inputClass} {...register(path("seo.ogImage"))} />
            <p className={hintClass}>
              Leave blank to use the first image, or the shop&apos;s branded card where there is none.
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="seo-canonical">Canonical URL</label>
            <input
              id="seo-canonical"
              className={inputClass}
              placeholder={previewUrl}
              {...register(path("seo.canonicalUrl"))}
            />
            <p className={hintClass}>
              Only set this to point search engines at a different page as the original. Renamed URLs
              already redirect on their own — this is not the tool for that.
            </p>
          </div>

          <Controller
            name={path("seo.noIndex")}
            control={control}
            render={({ field }) => (
              <div className="flex items-start gap-3">
                <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                <div>
                  <p className="text-sm font-medium">Hide from search engines</p>
                  <p className={hintClass}>
                    Removes the page from Google and from the sitemap. The page stays live and
                    shoppable — this only affects search.
                  </p>
                </div>
              </div>
            )}
          />
        </div>
      ) : null}
    </div>
  );
}
