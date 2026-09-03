"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { ImageUp, Link2, Star, X } from "lucide-react";
import { uploadMediaFiles } from "@/components/admin/MediaUploadButton";
import { cleanProductTitle, composeImageAlt, extractMaterials } from "@/lib/seo/product-content";
import { detectBrand } from "@/lib/seo/brands";
import type { ProductFormValues } from "@/lib/validation/product";

/**
 * Product images, managed where the product is.
 *
 * Adding a photograph used to mean: open the Media Library, upload there, copy the stored
 * URL, come back, paste it into a text field, then type alt text — with nothing on screen
 * confirming you had pasted the right one until the product was saved and viewed. Files
 * now drop straight onto this panel and attach themselves.
 *
 * The first image is the one that matters: images[0] is the card image on every listing,
 * images[1] the hover swap. That ordering was invisible in a column of URL inputs, so it
 * is now a badge on the first thumbnail and a click on any other to promote it.
 *
 * Pasting a URL is still possible and deliberately kept — the 175 imported products point
 * at external hosts, and an admin editing one of those needs to be able to see and change
 * that URL rather than being forced to re-upload the file.
 */

interface ProductImageManagerProps {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
  /** The whole `images` branch, so a rejected alt text can be shown ON the photo it
   *  belongs to rather than only as an array-level message with no home. */
  errors?: FieldErrors<ProductFormValues>["images"];
}

export function ProductImageManager({ control, register, setValue, errors }: ProductImageManagerProps) {
  const { fields, append, remove, move, replace } = useFieldArray({ control, name: "images" });
  // The rendered thumbnails follow the live values, not `fields` — `fields` is a snapshot
  // taken when the array changes, so a URL typed into the fallback input below would never
  // show a preview.
  const images = useWatch({ control, name: "images" }) ?? [];

  /**
   * Alt text is written from the product, not left to be typed.
   *
   * It was empty on purpose at first — a description ought to be considered, and 175
   * imported products carried alt text that merely repeated their own name. But required
   * and empty is a trap: the form refuses to save and the reason sits under a thumbnail
   * nobody has scrolled to. Composed alt text at least describes the shoe (its colour,
   * style, material and brand, with the stock code stripped), which is more than the
   * WooCommerce boilerplate it replaces, and it stays editable.
   *
   * `composeImageAlt` is the same function the bulk script used, so a photo added today is
   * described the way the existing catalogue is.
   */
  const [productName, productDescription] = useWatch({ control, name: ["name", "description"] });

  function altFor(index: number): string {
    const name = productName?.trim();
    if (!name) return "";
    return composeImageAlt({
      title: cleanProductTitle(name),
      brand: detectBrand(name),
      materials: extractMaterials(`${name} ${productDescription ?? ""}`),
      index,
    });
  }

  /**
   * What this component last wrote into each alt field.
   *
   * Alt text is free prose, so there is no pattern that says "this was generated" the way a
   * size SKU can be recognised from its shape. Remembering what was written is the
   * equivalent: an alt still equal to the last derived value is ours to update, anything
   * else was typed by a person and is left alone.
   *
   * Empty at mount, which is what protects the 175 imported products — their stored alt text
   * was never written by this component, so it is never treated as ours.
   */
  const lastDerivedAlt = useRef<Record<number, string>>({});

  /**
   * Keeps alt text in step with the product name: fills it in when it is blank, and
   * rewrites it when the name changes under a value this component itself put there.
   *
   * An effect rather than something that only happens at upload, because photographs are
   * usually dropped in before the name is typed. Writing only when the value actually
   * differs is what keeps it from looping through `images`.
   */
  useEffect(() => {
    images.forEach((image, index) => {
      if (!image?.src?.trim()) return;

      const current = image.alt ?? "";
      const isOurs = !current.trim() || current === lastDerivedAlt.current[index];
      if (!isOurs) return;

      const derived = altFor(index);
      if (!derived || derived === current) return;

      lastDerivedAlt.current[index] = derived;
      setValue(`images.${index}.alt`, derived, { shouldValidate: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- altFor is derived from these.
  }, [images, productName, productDescription, setValue]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlField, setShowUrlField] = useState(false);

  async function handleFiles(fileList: FileList | File[] | null) {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    const result = await uploadMediaFiles(files);
    setIsUploading(false);

    if (!result.ok) {
      setUploadError(result.error);
      return;
    }

    // Alt text is composed here rather than after the fact, so a new thumbnail never
    // appears with an empty box under it. See altFor above.
    const kept = images.filter((image) => image.src?.trim());
    const uploaded = result.media.map((media, offset) => {
      const index = kept.length + offset;
      const alt = altFor(index);
      lastDerivedAlt.current[index] = alt;
      return { src: media.url, alt };
    });

    /**
     * `replace`, not `append`: a new product starts with one blank row from
     * `emptyProductFormValues`, and that row is a placeholder rather than an image.
     *
     * Appending past it left `images[0]` empty forever. The grid hides it (there is no
     * preview to draw), so the merchandiser saw their photo attached and nothing wrong —
     * while the resolver rejected `images.0.src` on every submit and "Create product" sat
     * there doing nothing. Dropping empty rows as soon as a real image arrives is what
     * makes the visible state and the validated state the same state.
     */
    replace([...kept, ...uploaded]);

    if (inputRef.current) inputRef.current.value = "";
  }

  // The first blank slot from `emptyProductFormValues` would otherwise render as a broken
  // thumbnail before anything has been uploaded.
  const visible = images.map((img, index) => ({ ...img, index })).filter((img) => img.src?.trim());

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          // dragleave also fires when the pointer crosses onto a child, so only clear when
          // it has genuinely left the drop zone.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${
          isDragging ? "border-luxe-black bg-luxe-gray-light/50" : "border-border"
        }`}
      >
        <ImageUp className="size-6 text-luxe-gray-dark" strokeWidth={1.5} />
        <p className="text-sm">
          Drag photos here, or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="underline underline-offset-4 hover:opacity-70"
          >
            choose files
          </button>
        </p>
        <p className="text-xs text-luxe-gray-dark">
          {isUploading ? "Uploading…" : "JPEG, PNG, WebP or AVIF · up to 12 MB each"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
      {errors?.message ? <p className="text-xs text-destructive">{errors.message}</p> : null}

      {visible.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((img) => {
            const isMain = img.index === 0;
            return (
              <div key={fields[img.index]?.id ?? img.index} className="space-y-2">
                <div className="group relative aspect-3/4 overflow-hidden border border-border bg-luxe-gray-light">
                  <Image src={img.src} alt={img.alt || "Product image"} fill className="object-cover" sizes="200px" />

                  {isMain ? (
                    <span className="absolute top-2 left-2 bg-luxe-black px-2 py-1 text-[10px] font-medium tracking-[0.08em] text-luxe-white uppercase">
                      Main
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => move(img.index, 0)}
                      title="Use as main image"
                      className="absolute top-2 left-2 flex items-center gap-1 bg-luxe-white/90 px-2 py-1 text-[10px] font-medium tracking-[0.08em] uppercase opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Star className="size-3" strokeWidth={1.5} />
                      Set main
                    </button>
                  )}

                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={() => remove(img.index)}
                    className="absolute top-2 right-2 flex size-7 items-center justify-center bg-luxe-white/90 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3.5" strokeWidth={1.5} />
                  </button>
                </div>

                <input
                  className="h-9 w-full border border-border bg-transparent px-2 text-xs outline-none focus:border-luxe-black"
                  placeholder="Describe this photo"
                  aria-invalid={Boolean(errors?.[img.index]?.alt)}
                  {...register(`images.${img.index}.alt`)}
                />
                {errors?.[img.index]?.alt?.message ? (
                  <p className="text-xs text-destructive">{errors[img.index]?.alt?.message}</p>
                ) : null}
                {/* Hidden, but registered — the URL still has to reach the form payload. */}
                <input type="hidden" {...register(`images.${img.index}.src`)} />
              </div>
            );
          })}
        </div>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => setShowUrlField((open) => !open)}
          className="flex items-center gap-1 text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark hover:text-luxe-black"
        >
          <Link2 className="size-3.5" strokeWidth={1.5} />
          {showUrlField ? "Hide" : "Add by URL instead"}
        </button>

        {showUrlField ? (
          <div className="mt-2 space-y-2">
            {/* Every slot's URL, editable — including the imported products that point at
                external hosts rather than at this shop's own storage. */}
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <input
                  className="h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black"
                  placeholder="https://…"
                  {...register(`images.${index}.src`)}
                />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => remove(index)}
                  className="flex size-10 shrink-0 items-center justify-center border border-border"
                >
                  <X className="size-4" strokeWidth={1.5} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => append({ src: "", alt: "" })}
              className="text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark hover:text-luxe-black"
            >
              Add another URL
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
