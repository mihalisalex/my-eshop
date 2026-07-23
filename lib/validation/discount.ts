import { z } from "zod";

export const discountFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .transform((v) => v.toUpperCase()),
  type: z.enum(["percentage", "fixed"]),
  value: z.number().positive("Must be greater than 0"),
  active: z.boolean(),
  // Empty string means "no expiry" — kept as a plain optional string (date input value),
  // not coerced/preprocessed, per the established rule against z.coerce/z.preprocess in
  // any schema shared with zodResolver.
  expiresAt: z.string().optional(),
});
export type DiscountFormValues = z.infer<typeof discountFormSchema>;

export const emptyDiscountFormValues: DiscountFormValues = {
  code: "",
  type: "percentage",
  value: 10,
  active: true,
  expiresAt: undefined,
};
