import { z } from "zod";
import { isSupportedCountryCode } from "@/constants/countries";

export const contactSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
});
export type ContactFormValues = z.infer<typeof contactSchema>;

/**
 * The fields that never changed their rules, shared by both schemas below.
 */
const addressBase = {
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  company: z.string().trim().optional(),
  address1: z.string().trim().min(3, "Enter a street address"),
  address2: z.string().trim().optional(),
  city: z.string().trim().min(1, "City is required"),
  region: z.string().trim().optional(),
  postalCode: z.string().trim().min(2, "Enter a valid postal code"),
};

/**
 * For addresses ALREADY PERSISTED — order snapshots, saved customer addresses, checkout
 * rows written before the rules tightened.
 *
 * This split is not cosmetic. `addressSchema` does double duty as an input validator and
 * as the parser for stored JSON (`toOrder`, `toCheckout`, `completeCheckout`), so making
 * `phone` required immediately broke every order placed while it was optional: the admin
 * dashboard and orders list both 500'd on a ZodError the moment they tried to read one.
 * Tightening what the app ACCEPTS must never retroactively invalidate what it already
 * WROTE — historical records are facts, not submissions, and cannot be corrected by the
 * person now reading them.
 */
export const storedAddressSchema = z.object({
  ...addressBase,
  countryCode: z.string().trim().min(2),
  phone: z.string().trim().optional(),
});
export type StoredAddress = z.infer<typeof storedAddressSchema>;

/** The strict INPUT schema: what a form or API request must supply today. */
export const addressSchema = z.object({
  ...addressBase,
  // Checked against the list the shop actually ships to, not just "at least two
  // characters" — the previous rule accepted any string, so a crafted request could
  // put an arbitrary value on the order and every downstream country-based rule
  // (payment-method availability, future shipping zones) would silently not match it.
  countryCode: z
    .string({ error: "Select a country" })
    .trim()
    .transform((value) => value.toUpperCase())
    .refine(isSupportedCountryCode, "We don't ship to that country yet"),
  // Required, not optional. Every order this shop can currently take is Cash on
  // Delivery, and a courier delivering to a Greek address needs a number to call. It
  // was optional and format-free, so an order could reach the courier with no way to
  // contact the customer. Kept deliberately loose on format: real numbers arrive with
  // spaces, dashes, brackets and an optional +country prefix, and rejecting a valid
  // number is worse than accepting a slightly odd one.
  // The `error` argument covers the MISSING-key case as well as a wrong type. Without
  // it an omitted phone surfaced Zod's own "expected string, received undefined" to the
  // shopper — a type error dressed up as a validation message.
  phone: z
    .string({ error: "Phone number is required so the courier can reach you" })
    .trim()
    .min(1, "Phone number is required so the courier can reach you")
    .refine((value) => (value.match(/\d/g)?.length ?? 0) >= 8, "Enter a valid phone number")
    .refine((value) => /^[+\d][\d\s()./-]*$/.test(value), "Phone number can only contain digits, spaces and + ( ) - . /"),
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
