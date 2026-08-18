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
   * ΓΕΜΗ (General Commercial Registry) number. Not yet supplied, and mandatory on a Greek
   * commercial website — scripts/check-launch-placeholders.ts fails while this is null so
   * it cannot be forgotten. Set it to the registry number as a string.
   */
  gemiNumber: null as string | null,

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
