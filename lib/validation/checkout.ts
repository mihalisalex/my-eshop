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

/*
 * `cardSchema` (cardName / cardNumber / expiry / cvc) used to live here, backing a
 * demo card form on the payment step. It has been REMOVED deliberately, not
 * misplaced: this application must never accept a card number or a CVV, because
 * doing so pulls it into PCI scope and makes its own logs and error reports a
 * liability. Card data is collected on the payment processor's own page — see
 * lib/payments/providers/stripe.ts — and the only thing that comes back is a token
 * and a status. If a future integration appears to need a card field here, that is
 * a sign the integration is being wired up wrongly.
 */
