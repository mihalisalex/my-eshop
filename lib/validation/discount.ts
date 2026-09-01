import { z } from "zod";

export const discountFormSchema = z
  .object({
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
  })
  /**
   * A percentage over 100 is not a bigger discount, it is a broken order.
   *
   * `value` was only bounded below, so a mistyped "100" as "1000" produced a discount of
   * ten times the subtotal. Nothing goes negative — cart-totals clamps the taxable amount
   * at zero — but the shopper gets the goods for the price of shipping, and nothing in the
   * admin would look wrong. One misplaced keystroke, applied to every order until someone
   * noticed the takings.
   */
  .refine((data) => data.type !== "percentage" || data.value <= 100, {
    message: "A percentage discount can't be more than 100%.",
    path: ["value"],
  });

export type DiscountFormValues = z.infer<typeof discountFormSchema>;

export const emptyDiscountFormValues: DiscountFormValues = {
  code: "",
  type: "percentage",
  value: 10,
  active: true,
  expiresAt: undefined,
};
