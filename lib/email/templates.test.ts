import { describe, expect, it } from "vitest";
import { backInStockEmail, orderConfirmationEmail, referralRewardEmail, welcomeEmail } from "@/lib/email/templates";

/**
 * SEC-002. `escapeHtml` existed and was applied to SOME interpolations — line item names,
 * colours, sizes, image alt — but not to customer names, product names or addresses. The
 * inconsistency was the bug: whoever wrote it knew to escape and missed several.
 *
 * The helpers (`heading`, `bodyText`, `eyebrow`) interpolate raw HTML on purpose, because
 * some callers pass deliberate markup — so escaping has to happen at each call site, and
 * only a test can keep it there.
 */
const PAYLOAD = '<img src=x onerror="alert(1)">';
const ESCAPED = "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;";

const address = {
  firstName: PAYLOAD,
  lastName: "Παπαδόπουλος",
  address1: "Ερμού 1",
  city: "Αθήνα",
  postalCode: "10563",
  countryCode: "GR",
} as Parameters<typeof orderConfirmationEmail>[0]["shippingAddress"];

describe("email templates escape user-controlled values", () => {
  it("escapes a customer's own name in the welcome email", () => {
    const { html } = welcomeEmail({ siteName: "Alexandris", firstName: PAYLOAD, shopUrl: "https://example.com" });
    expect(html).not.toContain(PAYLOAD);
    expect(html).toContain(ESCAPED);
  });

  it("escapes the REFERRED friend's name — someone else's input, in this recipient's inbox", () => {
    const { html } = referralRewardEmail({
      siteName: "Alexandris",
      firstName: "Μαρία",
      friendFirstName: PAYLOAD,
      giftCardCode: "GIFT-1234",
      giftCardAmount: { amount: 10, currencyCode: "EUR" },
    });
    expect(html).not.toContain(PAYLOAD);
    expect(html).toContain(ESCAPED);
  });

  it("escapes the product and size in a back-in-stock email", () => {
    const { html } = backInStockEmail({
      siteName: "Alexandris",
      productName: PAYLOAD,
      sizeName: "40",
      productUrl: "https://example.com/p",
    });
    expect(html).not.toContain(PAYLOAD);
    expect(html).toContain(ESCAPED);
  });

  it("escapes a shipping address in the order confirmation", () => {
    const { html, text } = orderConfirmationEmail({
      siteName: "Alexandris",
      orderId: "cmtl0000000000000000",
      lineItems: [],
      totals: {
        subtotal: { amount: 10, currencyCode: "EUR" },
        discountTotal: { amount: 0, currencyCode: "EUR" },
        giftCardTotal: { amount: 0, currencyCode: "EUR" },
        shippingTotal: { amount: 0, currencyCode: "EUR" },
        giftWrapTotal: { amount: 0, currencyCode: "EUR" },
        paymentFeeTotal: { amount: 0, currencyCode: "EUR" },
        taxTotal: { amount: 0, currencyCode: "EUR" },
        total: { amount: 10, currencyCode: "EUR" },
      } as Parameters<typeof orderConfirmationEmail>[0]["totals"],
      shippingAddress: address,
      shippingRate: { id: "standard", label: "Standard", description: "", estimatedDelivery: "3–5", price: { amount: 0, currencyCode: "EUR" } },
      giftWrap: false,
      giftMessage: undefined,
      paymentInstructions: null,
    });

    expect(html).not.toContain(PAYLOAD);
    expect(html).toContain(ESCAPED);

    /**
     * The plain-text body must NOT be escaped — a customer reading it in a text-only
     * client would see literal `&lt;`. This is why the escape sits at the HTML call site
     * rather than inside `addressLines`, which feeds both.
     */
    expect(text).toContain(PAYLOAD);
  });
});
