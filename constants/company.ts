/**
 * The trader behind this shop — one source of truth for the identity details Greek and
 * EU law require a distance seller to publish.
 *
 * These were placeholders until now (a reserved `.example` address that could never
 * receive mail, and `COMPANY_DETAILS_PENDING` throughout the legal pages), which is why
 * they live in one exported constant rather than being retyped into the footer, the
 * contact page, the legal documents and the structured data separately. One wrong copy
 * is how the demo address survived as long as it did.
 *
 * `legalName` is the name registered in ΓΕΜΗ and is what the legal documents must use.
 * `brandName` is the shopfront name and is what customers see everywhere else — the two
 * are deliberately separate, because using the trading name in a Privacy Policy defeats
 * the point of naming the data controller.
 */
export const COMPANY = {
  /** As registered in ΓΕΜΗ. Greek convention is surname first. */
  legalName: "Alexandris Michail",
  brandName: "ALEXANDRIS",

  address: {
    street: "Arthur Evans 9",
    postalCode: "71201",
    city: "Heraklion",
    region: "Crete",
    countryCode: "GR",
    country: "Greece",
  },

  /** ΑΦΜ — the Greek VAT identification number. */
  vatNumber: "146214557",

  /**
   * ΓΕΜΗ (General Commercial Registry) number, printed in the trader identity line when
   * one exists. Stays null while `gemiRegistration` is anything other than "registered".
   */
  gemiNumber: null as string | null,

  /**
   * Whether a ΓΕΜΗ number is expected at all — deliberately separate from `gemiNumber`,
   * because a null number means two very different things and only one of them is safe to
   * launch on.
   *
   * "unknown" is the dangerous state: nobody has answered, and shipping on it publishes a
   * commercial site that may be missing a legally required registration number. The launch
   * check fails on it so an unanswered question cannot slip out looking like an answered one.
   *
   * "not-registered" is the trader's own statement (recorded 2026-08-18): there is no number
   * to print, so `traderIdentityLine()` omits the label instead of showing an empty one, and
   * the launch check passes while still naming the decision. This is worth re-confirming with
   * an accountant — a Greek trader selling at distance is normally required to be registered,
   * and once registered the number must appear on the site. On the day it exists, set this to
   * "registered" and fill in `gemiNumber`; nothing else needs changing.
   */
  gemiRegistration: "not-registered" as "registered" | "not-registered" | "unknown",

  email: "alexandrisstores@gmail.com",
  /** Heraklion landline, displayed nationally and dialled internationally. */
  phone: "2814 001 031",
  phoneE164: "+302814001031",
} as const;

/** "Arthur Evans 9, 71201 Heraklion, Crete, Greece" — the one-line form for prose and footers. */
export function formattedAddress(): string {
  const { street, postalCode, city, region, country } = COMPANY.address;
  return `${street}, ${postalCode} ${city}, ${region}, ${country}`;
}

/**
 * The identity line that has to be reachable from every page. Includes ΓΕΜΗ only once a
 * number exists, rather than printing an empty label.
 */
export function traderIdentityLine(): string {
  const parts = [
    COMPANY.legalName,
    formattedAddress(),
    `VAT (ΑΦΜ) ${COMPANY.vatNumber}`,
    COMPANY.gemiNumber ? `ΓΕΜΗ ${COMPANY.gemiNumber}` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}
