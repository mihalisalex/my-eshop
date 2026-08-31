"use client";

import { useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { collectionFormSchema, type CollectionFormValues } from "@/lib/validation/collection";
import type { CollectionActionState } from "@/app/admin/(dashboard)/collections/actions";
import { SeoFieldset } from "@/components/admin/SeoFieldset";

const inputClass =
  "h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";
const labelClass = "mb-1.5 block text-eyebrow";
const errorClass = "mt-1.5 text-xs text-destructive";
const sectionClass = "space-y-4 border border-border bg-luxe-white p-6";
const sectionTitleClass = "mb-1 text-sm font-medium tracking-[0.05em] uppercase";

interface CollectionFormProps {
  defaultValues: CollectionFormValues;
  products: { id: string; name: string }[];
  /** Site-wide SEO settings, so the SEO preview can show the real templated title and URL. */
  seoDefaults: { siteUrl: string; titleTemplate: string };
  onSubmit: (values: CollectionFormValues) => Promise<CollectionActionState>;
  submitLabel?: string;
}

export function CollectionForm({ defaultValues, products, seoDefaults, onSubmit, submitLabel = "Save Collection" }: CollectionFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues,
  });

  // See ProductForm — `watch()` is not safely memoizable, `useWatch` is.
  const [seoTitle, seoDescription, seoSubtitle, seoSlug] = useWatch({
    control,
    name: ["title", "description", "subtitle", "slug"],
  });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await onSubmit(values);
    if (result?.error) setServerError(result.error);
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {serverError ? (
        <p className="border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{serverError}</p>
      ) : null}

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Identity</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="cf-title">Title</label>
            <input id="cf-title" className={inputClass} aria-invalid={Boolean(errors.title)} {...register("title")} />
            {errors.title ? <p className={errorClass}>{errors.title.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="cf-slug">Slug</label>
            <input id="cf-slug" className={inputClass} aria-invalid={Boolean(errors.slug)} {...register("slug")} />
            {errors.slug ? <p className={errorClass}>{errors.slug.message}</p> : null}
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="cf-subtitle">Subtitle (optional)</label>
          <input id="cf-subtitle" className={inputClass} {...register("subtitle")} />
        </div>
        <div>
          <label className={labelClass} htmlFor="cf-description">Description (optional)</label>
          <textarea id="cf-description" rows={3} className={inputClass.replace("h-10", "h-auto py-2")} {...register("description")} />
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Image</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="cf-image-src">Image URL</label>
            <input id="cf-image-src" className={inputClass} aria-invalid={Boolean(errors.image?.src)} {...register("image.src")} />
            {errors.image?.src ? <p className={errorClass}>{errors.image.src.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="cf-image-alt">Alt text</label>
            <input id="cf-image-alt" className={inputClass} aria-invalid={Boolean(errors.image?.alt)} {...register("image.alt")} />
            {errors.image?.alt ? <p className={errorClass}>{errors.image.alt.message}</p> : null}
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Call to Action (optional)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass} htmlFor="cf-ctaLabel">Label</label>
            <input id="cf-ctaLabel" className={inputClass} placeholder="Shop the Edit" {...register("ctaLabel")} />
          </div>
          <div>
            <label className={labelClass} htmlFor="cf-ctaHref">Link</label>
            <input id="cf-ctaHref" className={inputClass} placeholder="/collections/summer-collection" {...register("ctaHref")} />
          </div>
          <div>
            <label className={labelClass} htmlFor="cf-ctaVariant">Style</label>
            <Controller
              name="ctaVariant"
              control={control}
              render={({ field }) => (
                <select
                  id="cf-ctaVariant"
                  className={inputClass}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.value)}
                >
                  <option value="">None</option>
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="ghost">Ghost</option>
                  <option value="link">Link</option>
                </select>
              )}
            />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Search &amp; social</h3>
        {/* Collections had no SEO fields at all before this — their title and description
            were whatever read well on the storefront hero, doing double duty as metadata. */}
        <SeoFieldset
          register={register}
          control={control}
          fallbackTitle={seoTitle || "Collection title"}
          fallbackDescription={seoDescription || seoSubtitle || ""}
          previewUrl={`${seoDefaults.siteUrl.replace(/\/$/, "")}/collections/${seoSlug || "slug"}`}
          titleTemplate={seoDefaults.titleTemplate}
          showEditorial
        />
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Products</h3>
        {products.length > 0 ? (
          <Controller
            name="productIds"
            control={control}
            render={({ field }) => (
              <div className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto">
                {products.map((product) => {
                  const checked = field.value.includes(product.id);
                  return (
                    <label key={product.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          field.onChange(
                            e.target.checked
                              ? [...field.value, product.id]
                              : field.value.filter((id) => id !== product.id)
                          )
                        }
                      />
                      {product.name}
                    </label>
                  );
                })}
              </div>
            )}
          />
        ) : (
          <p className="text-sm text-luxe-gray-dark">No products in the catalog yet.</p>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-11 items-center justify-center bg-luxe-black px-8 text-sm font-medium tracking-[0.05em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
