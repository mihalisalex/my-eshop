"use client";

import { useState, type InputHTMLAttributes } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { productFormSchema, type ProductFormValues } from "@/lib/validation/product";
import type { ProductActionState } from "@/app/admin/(dashboard)/products/actions";

const inputClass =
  "h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";
const labelClass = "mb-1.5 block text-eyebrow";
const errorClass = "mt-1.5 text-xs text-destructive";
const sectionClass = "space-y-4 border border-border bg-luxe-white p-6";
const sectionTitleClass = "mb-1 text-sm font-medium tracking-[0.05em] uppercase";

interface ProductFormProps {
  defaultValues: ProductFormValues;
  collections: { id: string; title: string }[];
  onSubmit: (values: ProductFormValues) => Promise<ProductActionState>;
  submitLabel?: string;
}

/** Comma-separated text field bound to a string[] form value. */
function ListField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        defaultValue={value.join(", ")}
        placeholder={placeholder}
        onBlur={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          )
        }
      />
      <p className="mt-1 text-xs text-luxe-gray-dark">Comma-separated</p>
    </div>
  );
}

/** Numeric input bound to an optional-number form value. Parses manually instead of RHF's `valueAsNumber`, which turns an emptied field into NaN rather than undefined. */
function NumberField({
  value,
  onChange,
  ...props
}: { value: number | undefined; onChange: (next: number | undefined) => void } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
>) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      {...props}
    />
  );
}

export function ProductForm({ defaultValues, collections, onSubmit, submitLabel = "Save Product" }: ProductFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });

  const images = useFieldArray({ control, name: "images" });
  const colors = useFieldArray({ control, name: "colors" });
  const sizes = useFieldArray({ control, name: "sizes" });

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
            <label className={labelClass} htmlFor="pf-name">Name</label>
            <input id="pf-name" className={inputClass} aria-invalid={Boolean(errors.name)} {...register("name")} />
            {errors.name ? <p className={errorClass}>{errors.name.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="pf-slug">Slug</label>
            <input id="pf-slug" className={inputClass} aria-invalid={Boolean(errors.slug)} {...register("slug")} />
            {errors.slug ? <p className={errorClass}>{errors.slug.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="pf-sku">SKU</label>
            <input id="pf-sku" className={inputClass} aria-invalid={Boolean(errors.sku)} {...register("sku")} />
            {errors.sku ? <p className={errorClass}>{errors.sku.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="pf-barcode">Barcode (optional)</label>
            <input id="pf-barcode" className={inputClass} {...register("barcode")} />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="pf-description">Description</label>
          <textarea id="pf-description" rows={4} className={inputClass.replace("h-10", "h-auto py-2")} aria-invalid={Boolean(errors.description)} {...register("description")} />
          {errors.description ? <p className={errorClass}>{errors.description.message}</p> : null}
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Pricing ({defaultValues.currencyCode})</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass} htmlFor="pf-price">Price</label>
            <Controller
              name="price"
              control={control}
              render={({ field }) => (
                <NumberField id="pf-price" step="0.01" min={0} className={inputClass} aria-invalid={Boolean(errors.price)} value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.price ? <p className={errorClass}>{errors.price.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="pf-compareAtPrice">Compare-at price (optional)</label>
            <Controller
              name="compareAtPrice"
              control={control}
              render={({ field }) => (
                <NumberField id="pf-compareAtPrice" step="0.01" min={0} className={inputClass} value={field.value} onChange={field.onChange} />
              )}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="pf-salePrice">Sale price (optional)</label>
            <Controller
              name="salePrice"
              control={control}
              render={({ field }) => (
                <NumberField id="pf-salePrice" step="0.01" min={0} className={inputClass} value={field.value} onChange={field.onChange} />
              )}
            />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Organization</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="pf-category">Category</label>
            <input id="pf-category" className={inputClass} aria-invalid={Boolean(errors.category)} {...register("category")} />
            {errors.category ? <p className={errorClass}>{errors.category.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="pf-gender">Gender</label>
            <select id="pf-gender" className={inputClass} {...register("gender")}>
              <option value="women">Women</option>
              <option value="men">Men</option>
              <option value="unisex">Unisex</option>
              <option value="kids">Kids</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="pf-season">Season (optional)</label>
            <Controller
              name="season"
              control={control}
              render={({ field }) => (
                <select
                  id="pf-season"
                  className={inputClass}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.value)}
                >
                  <option value="">None</option>
                  <option value="spring-summer">Spring/Summer</option>
                  <option value="autumn-winter">Autumn/Winter</option>
                  <option value="resort">Resort</option>
                  <option value="all-season">All Season</option>
                </select>
              )}
            />
          </div>
        </div>

        <Controller
          name="tags"
          control={control}
          render={({ field }) => <ListField label="Tags" value={field.value} onChange={field.onChange} placeholder="outerwear, new" />}
        />
        <Controller
          name="materials"
          control={control}
          render={({ field }) => <ListField label="Materials" value={field.value} onChange={field.onChange} placeholder="80% Wool, 20% Polyester" />}
        />
        <Controller
          name="careInstructions"
          control={control}
          render={({ field }) => <ListField label="Care instructions" value={field.value} onChange={field.onChange} placeholder="Dry clean only" />}
        />
        <Controller
          name="relatedProductIds"
          control={control}
          render={({ field }) => <ListField label="Related product IDs (optional)" value={field.value} onChange={field.onChange} placeholder="p11, p4, p9" />}
        />

        {collections.length > 0 ? (
          <Controller
            name="collectionIds"
            control={control}
            render={({ field }) => (
              <div>
                <label className={labelClass}>Collections</label>
                <div className="grid grid-cols-2 gap-2">
                  {collections.map((collection) => {
                    const checked = field.value.includes(collection.id);
                    return (
                      <label key={collection.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            field.onChange(
                              e.target.checked
                                ? [...field.value, collection.id]
                                : field.value.filter((id) => id !== collection.id)
                            )
                          }
                        />
                        {collection.title}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          />
        ) : null}
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Images</h3>
        <div className="space-y-2">
          {images.fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <input
                className={inputClass}
                placeholder="Image URL"
                aria-invalid={Boolean(errors.images?.[index]?.src)}
                {...register(`images.${index}.src`)}
              />
              <input className={inputClass} placeholder="Alt text" {...register(`images.${index}.alt`)} />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => images.remove(index)}
                className="flex size-10 shrink-0 items-center justify-center border border-border"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
        {errors.images?.message ? <p className={errorClass}>{errors.images.message}</p> : null}
        <button
          type="button"
          onClick={() => images.append({ src: "", alt: "" })}
          className="flex items-center gap-1 text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark hover:text-luxe-black"
        >
          <Plus className="size-3.5" strokeWidth={1.5} />
          Add Image
        </button>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Colors</h3>
        <div className="space-y-2">
          {colors.fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <input type="color" className="size-10 shrink-0 border border-border p-1" {...register(`colors.${index}.hex`)} />
              <input className={inputClass} placeholder="Color name" {...register(`colors.${index}.name`)} />
              <input className={`${inputClass} font-mono uppercase`} placeholder="#111111" {...register(`colors.${index}.hex`)} />
              <button
                type="button"
                aria-label="Remove color"
                onClick={() => colors.remove(index)}
                className="flex size-10 shrink-0 items-center justify-center border border-border"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => colors.append({ name: "New Color", hex: "#000000" })}
          className="flex items-center gap-1 text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark hover:text-luxe-black"
        >
          <Plus className="size-3.5" strokeWidth={1.5} />
          Add Color
        </button>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Sizes &amp; Inventory</h3>
        <div className="space-y-2">
          {sizes.fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <input className={`${inputClass} max-w-24`} placeholder="Size" {...register(`sizes.${index}.name`)} />
              <Controller
                name={`sizes.${index}.quantity`}
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    placeholder="Quantity"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                  />
                )}
              />
              <input className={inputClass} placeholder="SKU (optional)" {...register(`sizes.${index}.sku`)} />
              <Controller
                name={`sizes.${index}.inStock`}
                control={control}
                render={({ field }) => (
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    <span className="w-14 text-xs text-luxe-gray-dark">{field.value ? "In stock" : "Out"}</span>
                  </div>
                )}
              />
              <button
                type="button"
                aria-label="Remove size"
                onClick={() => sizes.remove(index)}
                className="flex size-10 shrink-0 items-center justify-center border border-border"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
        {errors.sizes?.message ? <p className={errorClass}>{errors.sizes.message}</p> : null}
        <button
          type="button"
          onClick={() => sizes.append({ name: "New Size", inStock: true, quantity: 0 })}
          className="flex items-center gap-1 text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark hover:text-luxe-black"
        >
          <Plus className="size-3.5" strokeWidth={1.5} />
          Add Size
        </button>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Status &amp; Fulfillment</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("availableForSale")} />
            Available for sale
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("isNew")} />
            New
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("isSale")} />
            On sale
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("isPreorder")} />
            Preorder
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("isBackorder")} />
            Backorder
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="pf-inventoryPolicy">Inventory policy</label>
            <select id="pf-inventoryPolicy" className={inputClass} {...register("inventoryPolicy")}>
              <option value="deny">Deny (stop selling at 0 stock)</option>
              <option value="continue">Continue (allow overselling)</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="pf-fulfillmentNote">Fulfillment note (optional)</label>
            <input id="pf-fulfillmentNote" className={inputClass} placeholder="Ships Sept 12" {...register("fulfillmentNote")} />
          </div>
          <div>
            <label className={labelClass} htmlFor="pf-shippingWeightGrams">Shipping weight, grams (optional)</label>
            <Controller
              name="shippingWeightGrams"
              control={control}
              render={({ field }) => (
                <NumberField id="pf-shippingWeightGrams" min={0} className={inputClass} value={field.value} onChange={field.onChange} />
              )}
            />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>SEO (optional)</h3>
        <div>
          <label className={labelClass} htmlFor="pf-seo-title">Meta title</label>
          <input id="pf-seo-title" className={inputClass} {...register("seo.title")} />
        </div>
        <div>
          <label className={labelClass} htmlFor="pf-seo-description">Meta description</label>
          <textarea id="pf-seo-description" rows={2} className={inputClass.replace("h-10", "h-auto py-2")} {...register("seo.description")} />
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
