"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { blogFormSchema, type BlogFormValues } from "@/lib/validation/blog";
import type { BlogActionState } from "@/app/admin/(dashboard)/blog/actions";

const inputClass =
  "h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";
const labelClass = "mb-1.5 block text-eyebrow";
const errorClass = "mt-1.5 text-xs text-destructive";
const sectionClass = "space-y-4 border border-border bg-luxe-white p-6";
const sectionTitleClass = "mb-1 text-sm font-medium tracking-[0.05em] uppercase";

interface BlogPostFormProps {
  defaultValues: BlogFormValues;
  onSubmit: (values: BlogFormValues) => Promise<BlogActionState>;
  submitLabel?: string;
}

export function BlogPostForm({ defaultValues, onSubmit, submitLabel = "Save Post" }: BlogPostFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BlogFormValues>({
    resolver: zodResolver(blogFormSchema),
    defaultValues,
  });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await onSubmit({ ...values, tags: values.tags.filter(Boolean) });
    if (result?.error) setServerError(result.error);
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {serverError ? (
        <p className="border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{serverError}</p>
      ) : null}

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Post</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="bf-title">Title</label>
            <input id="bf-title" className={inputClass} aria-invalid={Boolean(errors.title)} {...register("title")} />
            {errors.title ? <p className={errorClass}>{errors.title.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="bf-slug">Slug</label>
            <input id="bf-slug" className={inputClass} aria-invalid={Boolean(errors.slug)} {...register("slug")} />
            {errors.slug ? <p className={errorClass}>{errors.slug.message}</p> : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="bf-author">Author</label>
            <input id="bf-author" className={inputClass} aria-invalid={Boolean(errors.author)} {...register("author")} />
            {errors.author ? <p className={errorClass}>{errors.author.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="bf-publishedAt">Published Date</label>
            <input
              id="bf-publishedAt"
              type="date"
              className={inputClass}
              aria-invalid={Boolean(errors.publishedAt)}
              {...register("publishedAt")}
            />
            {errors.publishedAt ? <p className={errorClass}>{errors.publishedAt.message}</p> : null}
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="bf-tags">Tags (comma-separated)</label>
          <input
            id="bf-tags"
            className={inputClass}
            defaultValue={defaultValues.tags.join(", ")}
            {...register("tags", {
              setValueAs: (value: string) =>
                typeof value === "string" ? value.split(",").map((t) => t.trim()).filter(Boolean) : value,
            })}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="bf-excerpt">Excerpt</label>
          <textarea id="bf-excerpt" rows={2} className={inputClass.replace("h-10", "h-auto py-2")} aria-invalid={Boolean(errors.excerpt)} {...register("excerpt")} />
          {errors.excerpt ? <p className={errorClass}>{errors.excerpt.message}</p> : null}
        </div>
        <div>
          <label className={labelClass} htmlFor="bf-content">Body (optional)</label>
          <textarea id="bf-content" rows={8} className={inputClass.replace("h-10", "h-auto py-2")} {...register("content")} />
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Cover Image</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="bf-image-src">Image URL</label>
            <input id="bf-image-src" className={inputClass} aria-invalid={Boolean(errors.coverImage?.src)} {...register("coverImage.src")} />
            {errors.coverImage?.src ? <p className={errorClass}>{errors.coverImage.src.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="bf-image-alt">Alt text</label>
            <input id="bf-image-alt" className={inputClass} aria-invalid={Boolean(errors.coverImage?.alt)} {...register("coverImage.alt")} />
            {errors.coverImage?.alt ? <p className={errorClass}>{errors.coverImage.alt.message}</p> : null}
          </div>
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
