import { z } from "zod";

export const contactSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
});
export type ContactFormValues = z.infer<typeof contactSchema>;

export const addressSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  company: z.string().trim().optional(),
  address1: z.string().trim().min(3, "Enter a street address"),
  address2: z.string().trim().optional(),
  city: z.string().trim().min(1, "City is required"),
  region: z.string().trim().optional(),
  postalCode: z.string().trim().min(2, "Enter a valid postal code"),
  countryCode: z.string().trim().min(2, "Select a country"),
  phone: z.string().trim().optional(),
});
export type AddressFormValues = z.infer<typeof addressSchema>;

export const cardSchema = z.object({
  cardName: z.string().trim().min(1, "Name on card is required"),
  cardNumber: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ""))
    .refine((v) => /^\d{13,19}$/.test(v), "Enter a valid card number"),
  expiry: z.string().trim().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use MM/YY"),
  cvc: z.string().trim().regex(/^\d{3,4}$/, "3–4 digits"),
});
export type CardFormValues = z.infer<typeof cardSchema>;
