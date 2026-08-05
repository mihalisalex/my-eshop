"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Switch } from "@/components/ui/switch";
import { categoryFormSchema, type CategoryFormValues } from "@/lib/validation/category";
import type { CategoryActionState } from "@/app/admin/(dashboard)/categories/actions";
import type { CategoryOption } from "@/types/category";

const inputClass =
  "h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";
const labelClass = "mb-1.5 block text-eyebrow";
const errorClass = "mt-1.5 text-xs text-destructive";
const sectionClass = "space-y-4 border border-border bg-luxe-white p-6";
const sectionTitleClass = "mb-1 text-sm font-medium tracking-[0.05em] uppercase";

interface CategoryFormProps {
  defaultValues: CategoryFormValues;
  /** Every OTHER category, flattened with tree depth — already excludes this category and its
   * own subtree (services/categories.ts's getCategoryOptions) so the parent picker can't create a cycle. */
  parentOptions: CategoryOption[];
  onSubmit: (values: CategoryFormValues) => Promise<CategoryActionState>;
  submitLabel?: string;
}

export function CategoryForm({ defaultValues, parentOptions, onSubmit, submitLabel = "Save Category" }: CategoryFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues,
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
            <label className={labelClass} htmlFor="cgf-name">Name</label>
            <input id="cgf-name" className={inputClass} aria-invalid={Boolean(errors.name)} {...register("name")} />
            {errors.name ? <p className={errorClass}>{errors.name.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="cgf-slug">Slug</label>
            <input id="cgf-slug" className={inputClass} aria-invalid={Boolean(errors.slug)} {...register("slug")} />
            {errors.slug ? <p className={errorClass}>{errors.slug.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="cgf-nameEl">Name (Greek, optional)</label>
            <input id="cgf-nameEl" className={inputClass} {...register("nameEl")} />
          </div>
          <div>
            <label className={labelClass} htmlFor="cgf-parent">Parent category</label>
            <select id="cgf-parent" className={inputClass} {...register("parentId")}>
              <option value="">— Top level —</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {"    ".repeat(option.depth)}
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="cgf-description">Description (optional)</label>
          <textarea id="cgf-description" rows={3} className={inputClass.replace("h-10", "h-auto py-2")} {...register("description")} />
        </div>
        <div>
          <label className={labelClass} htmlFor="cgf-descriptionEl">Description (Greek, optional)</label>
          <textarea id="cgf-descriptionEl" rows={3} className={inputClass.replace("h-10", "h-auto py-2")} {...register("descriptionEl")} />
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Imagery</h3>
        <p className="text-xs text-luxe-gray-dark">Leave a URL blank to skip that image entirely; if you set a URL, its alt text is required.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="cgf-image-src">Card image URL (optional)</label>
            <input id="cgf-image-src" className={inputClass} aria-invalid={Boolean(errors.image?.src)} {...register("image.src")} />
            {errors.image?.src ? <p className={errorClass}>{errors.image.src.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="cgf-image-alt">Card image alt text</label>
            <input id="cgf-image-alt" className={inputClass} aria-invalid={Boolean(errors.image?.alt)} {...register("image.alt")} />
            {errors.image?.alt ? <p className={errorClass}>{errors.image.alt.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="cgf-banner-src">Banner image URL (optional)</label>
            <input id="cgf-banner-src" className={inputClass} aria-invalid={Boolean(errors.bannerImage?.src)} {...register("bannerImage.src")} />
            {errors.bannerImage?.src ? <p className={errorClass}>{errors.bannerImage.src.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="cgf-banner-alt">Banner image alt text</label>
            <input id="cgf-banner-alt" className={inputClass} aria-invalid={Boolean(errors.bannerImage?.alt)} {...register("bannerImage.alt")} />
            {errors.bannerImage?.alt ? <p className={errorClass}>{errors.bannerImage.alt.message}</p> : null}
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>SEO (optional — falls back to name/description)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="cgf-seo-title">SEO title</label>
            <input id="cgf-seo-title" className={inputClass} {...register("seo.title")} />
          </div>
          <div>
            <label className={labelClass} htmlFor="cgf-seo-ogImage">Social share image URL</label>
            <input id="cgf-seo-ogImage" className={inputClass} {...register("seo.ogImage")} />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="cgf-seo-description">SEO description</label>
          <textarea id="cgf-seo-description" rows={2} className={inputClass.replace("h-10", "h-auto py-2")} {...register("seo.description")} />
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Visibility</h3>
        <div className="flex flex-wrap gap-8">
          <Controller
            name="isVisible"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                Visible on the storefront
              </label>
            )}
          />
          <Controller
            name="isFeatured"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                Featured
              </label>
            )}
          />
        </div>
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
