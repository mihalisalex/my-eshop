import { z } from "zod";

export const giftCardFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .transform((v) => v.toUpperCase()),
  balanceAmount: z.number().positive("Must be greater than 0"),
  active: z.boolean(),
});
export type GiftCardFormValues = z.infer<typeof giftCardFormSchema>;

export const emptyGiftCardFormValues: GiftCardFormValues = {
  code: "",
  balanceAmount: 50,
  active: true,
};
