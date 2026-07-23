"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { discountFormSchema, type DiscountFormValues } from "@/lib/validation/discount";
import type { DiscountActionState } from "@/app/admin/(dashboard)/discounts/actions";

const inputClass =
  "h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";
const labelClass = "mb-1.5 block text-eyebrow";
const errorClass = "mt-1.5 text-xs text-destructive";
const sectionClass = "space-y-4 border border-border bg-luxe-white p-6";

interface DiscountFormProps {
  defaultValues: DiscountFormValues;
  onSubmit: (values: DiscountFormValues) => Promise<DiscountActionState>;
  submitLabel?: string;
}

export function DiscountForm({ defaultValues, onSubmit, submitLabel = "Save Discount" }: DiscountFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DiscountFormValues>({
    resolver: zodResolver(discountFormSchema),
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="df-code">
              Code
            </label>
            <input id="df-code" className={inputClass} aria-invalid={Boolean(errors.code)} {...register("code")} />
            {errors.code ? <p className={errorClass}>{errors.code.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="df-type">
              Type
            </label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <select id="df-type" className={inputClass} value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="df-value">
              Value
            </label>
            <Controller
              name="value"
              control={control}
              render={({ field }) => (
                <input
                  id="df-value"
                  type="number"
                  step="0.01"
                  className={inputClass}
                  aria-invalid={Boolean(errors.value)}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                />
              )}
            />
            {errors.value ? <p className={errorClass}>{errors.value.message}</p> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="df-expiresAt">
              Expires (optional)
            </label>
            <Controller
              name="expiresAt"
              control={control}
              render={({ field }) => (
                <input
                  id="df-expiresAt"
                  type="date"
                  className={inputClass}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.value)}
                />
              )}
            />
          </div>
        </div>

        <Controller
          name="active"
          control={control}
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
              Active
            </label>
          )}
        />
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
