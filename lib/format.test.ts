import { describe, expect, it } from "vitest";
import { formatDate, formatMoney } from "./format";

/**
 * Both formatters default to the SITE's locale rather than "en-US". That is a decision, not
 * an accident, and it is the kind that gets silently reverted by someone adding a locale
 * argument somewhere — hence tests.
 */
describe("formatMoney", () => {
  const eur = (amount: number) => formatMoney({ amount, currencyCode: "EUR" });

  it("uses Greek conventions by default: comma decimals, symbol last", () => {
    // U+00A0 before the symbol — Intl uses a non-breaking space, not a plain one.
    expect(eur(34.9)).toBe("34,90 €");
  });

  it("uses a full stop for thousands, which is the inversion that matters", () => {
    // Under en-US this printed "€1,234.50". To a Greek reader those separators are swapped,
    // so the old output could be misread as a different amount rather than a different style.
    expect(eur(1234.5)).toBe("1.234,50 €");
  });

  it("omits decimals for whole amounts", () => {
    expect(eur(59)).toBe("59 €");
    expect(eur(0)).toBe("0 €");
  });

  it("still honours an explicit locale", () => {
    expect(formatMoney({ amount: 34.9, currencyCode: "EUR" }, "en-US")).toBe("€34.90");
  });

  it("formats the currency it is given, not a hardcoded euro", () => {
    expect(formatMoney({ amount: 10, currencyCode: "USD" }, "en-US")).toBe("$10");
  });
});

describe("formatDate", () => {
  it("writes Greek month names by default", () => {
    // Was "July 1, 2026" under the old en-US default, printed beneath Greek headings.
    expect(formatDate("2026-07-01")).toBe("1 Ιουλίου 2026");
  });

  it("still honours an explicit locale", () => {
    expect(formatDate("2026-07-01", "en-US")).toBe("July 1, 2026");
  });
});
