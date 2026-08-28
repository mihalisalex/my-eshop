import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Address, CartLineItem, CartTotals, ShippingRate } from "@/lib/commerce/types";
import * as templates from "@/lib/email/templates";

/**
 * Renders every email template to `.preview/emails/*.html` with representative data,
 * so the design can be looked at in a browser instead of guessed at.
 *
 *   npx tsx scripts/preview-emails.ts
 *
 * Email HTML cannot be iterated on the way page CSS can — there is no dev server, no
 * hot reload, and the only honest feedback loop is "send it and look". Sending eleven
 * real emails to inspect a padding change is both slow and, on an unverified Resend
 * domain, impossible. This writes the same HTML those sends would carry.
 *
 * The sample data is deliberately Greek and deliberately unflattering: long product
 * names that wrap, a discount and a gift card both applied, a two-line address, a
 * gift message. A template that looks right only with short English strings is a
 * template that breaks on the real catalogue.
 */
const eur = (amount: number) => ({ amount, currencyCode: "EUR" });

const LINE_ITEMS: CartLineItem[] = [
  {
    id: "li_1",
    productId: "p_1",
    slug: "dermatino-mpotaki-me-fermouar",
    name: "Δερμάτινο Μποτάκι με Φερμουάρ",
    image: { src: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=240&h=300&fit=crop", alt: "Δερμάτινο μποτάκι" },
    color: "Μαύρο",
    size: "42",
    unitPrice: eur(129.9),
    quantity: 1,
    maxQuantity: 4,
    savedForLater: false,
    addedAt: "2026-08-27T10:00:00.000Z",
  },
  {
    id: "li_2",
    productId: "p_2",
    slug: "sneaker-leukó-derma",
    name: "Sneaker από Λευκό Δέρμα με Χαμηλή Σόλα",
    image: { src: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=240&h=300&fit=crop", alt: "Λευκό sneaker" },
    color: "Λευκό",
    size: "41",
    unitPrice: eur(89.9),
    quantity: 2,
    maxQuantity: 6,
    savedForLater: false,
    addedAt: "2026-08-27T10:05:00.000Z",
  },
];

const TOTALS: CartTotals = {
  subtotal: eur(309.7),
  discountTotal: eur(30.97),
  giftCardTotal: eur(20),
  shippingTotal: eur(0),
  giftWrapTotal: eur(5),
  paymentFeeTotal: eur(2),
  taxTotal: eur(63.24),
  total: eur(265.73),
};

const ADDRESS: Address = {
  firstName: "Μιχάλης",
  lastName: "Αλεξανδρής",
  address1: "Λεωφόρος Κηφισίας 124",
  address2: "Διαμέρισμα 3, 2ος όροφος",
  city: "Αθήνα",
  region: "Αττική",
  postalCode: "11526",
  countryCode: "GR",
  phone: "+30 210 000 0000",
};

const RATE: ShippingRate = {
  id: "standard",
  label: "Παράδοση κατ' οίκον",
  description: "ACS Courier",
  price: eur(0),
  estimatedDelivery: "2–4 εργάσιμες ημέρες",
};

const SITE = "ALEXANDRIS";
const URL = "https://shopalexandris.vercel.app";

const PAGES: { name: string; rendered: { subject: string; html: string } }[] = [
  { name: "welcome", rendered: templates.welcomeEmail({ siteName: SITE, firstName: "Μιχάλη", shopUrl: URL }) },
  {
    name: "order-confirmation",
    rendered: templates.orderConfirmationEmail({
      siteName: SITE,
      orderId: "clx8k2m4p0001abcd1234efgh",
      lineItems: LINE_ITEMS,
      totals: TOTALS,
      shippingAddress: ADDRESS,
      shippingRate: RATE,
      giftWrap: true,
      giftMessage: "Χρόνια πολλά! Με αγάπη, Μιχάλης",
      paymentInstructions: [
        { label: "Τράπεζα", value: "Piraeus Bank" },
        { label: "Δικαιούχος", value: "MICHAIL ALEXANDRIS" },
        { label: "IBAN", value: "GR16 0110 1250 0000 0001 2300 695" },
      ],
    }),
  },
  {
    name: "shipping-shipped",
    rendered: templates.shippingUpdateEmail({
      siteName: SITE,
      orderId: "clx8k2m4p0001abcd1234efgh",
      status: "shipped",
      lineItems: LINE_ITEMS,
      trackingNumber: "AC1234567890GR",
      carrier: "ACS Courier",
      trackingUrl: "https://www.acscourier.net/el/track/AC1234567890GR",
    }),
  },
  { name: "password-reset", rendered: templates.passwordResetEmail({ siteName: SITE, resetUrl: `${URL}/account/reset-password?token=abc`, expiresInMinutes: 30 }) },
  { name: "account-already-exists", rendered: templates.accountAlreadyExistsEmail({ siteName: SITE, loginUrl: `${URL}/account/login` }) },
  {
    name: "referral-reward",
    rendered: templates.referralRewardEmail({ siteName: SITE, firstName: "Μιχάλη", friendFirstName: "Ελένη", giftCardCode: "ALX-9F3K-22QP", giftCardAmount: eur(20) }),
  },
  { name: "abandoned-cart", rendered: templates.abandonedCartEmail({ siteName: SITE, lineItems: LINE_ITEMS, resumeUrl: `${URL}/cart?cart=abc` }) },
  { name: "review-request", rendered: templates.reviewRequestEmail({ siteName: SITE, orderId: "clx8k2m4p0001abcd1234efgh", lineItems: LINE_ITEMS, siteUrl: URL }) },
  { name: "back-in-stock", rendered: templates.backInStockEmail({ siteName: SITE, productName: LINE_ITEMS[0].name, sizeName: "42", productUrl: `${URL}/products/x` }) },
  { name: "return-status-update", rendered: templates.returnStatusUpdateEmail({ siteName: SITE, orderId: "clx8k2m4p0001abcd1234efgh", status: "approved" }) },
  { name: "contact-message", rendered: templates.contactMessageNotificationEmail({ siteName: SITE, name: "Ελένη Παπαδοπούλου", email: "eleni@example.gr", subject: "Ερώτηση για μέγεθος", message: "Καλησπέρα, το μποτάκι έρχεται μικρό ή κανονικό;" }) },
];

const outDir = resolve(".preview/emails");
mkdirSync(outDir, { recursive: true });

const index: string[] = [];
for (const page of PAGES) {
  writeFileSync(resolve(outDir, `${page.name}.html`), page.rendered.html, "utf8");
  index.push(`<li><a href="./${page.name}.html">${page.name}</a> <span>${page.rendered.subject}</span></li>`);
}

writeFileSync(
  resolve(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Email previews</title>
<style>body{font:14px/1.7 -apple-system,system-ui,sans-serif;max-width:760px;margin:60px auto;padding:0 20px;color:#111}
h1{font-weight:400;letter-spacing:3px;text-transform:uppercase;font-size:16px;margin-bottom:32px}
li{margin:0 0 10px;list-style:none}a{color:#111;font-weight:600}span{color:#888;margin-left:10px}</style>
<h1>Email previews</h1><ul>${index.join("")}</ul>`,
  "utf8"
);

console.log(`Rendered ${PAGES.length} templates to ${outDir}`);
console.log("Open .preview/emails/index.html");
