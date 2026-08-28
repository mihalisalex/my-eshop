import { formatMoney } from "@/lib/format";
import type { Address, CartLineItem, CartTotals, ShippingRate } from "@/lib/commerce/types";

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const INK = "#111111";
const MUTED = "#9A9A9A";
const BODY = "#5F5F5F";
const HAIRLINE = "#E6E6E6";
const WIDTH = 600;

/** Footer links need an absolute URL, and emails are rendered from contexts with no request. */
function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://shopalexandris.vercel.app";
}

/**
 * Escapes values that reach an email body from a configurable source rather than
 * from our own code. Payment instructions are admin-authored (bank name, IBAN,
 * free-text notes), which is the same trust level that produced the stored-XSS
 * finding in the JSON-LD work — see lib/json-ld.ts. An email client is a weaker
 * execution context than a browser, but broken markup from an unescaped `&` or `<`
 * is reason enough on its own.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Table-based layout with inline styles, not a <style> block — the only markup
 * pattern that renders consistently across real email clients (Gmail/Outlook both
 * strip <head> styles).
 *
 * The design deliberately does NOT frame the message as a card floating on grey.
 * That treatment reads as "transactional template" however good the type inside it
 * is, because every SaaS receipt uses it. Luxury fashion mail is white to the edges,
 * with the wordmark small and black on white rather than reversed out of a heavy
 * masthead slab, and it buys presence with whitespace and scale instead of with
 * rules, borders and filled panels. The only element permitted to be large is the
 * photography.
 *
 * `color-scheme: light` is declared because Gmail and Outlook in dark mode otherwise
 * invert the palette themselves — turning the wordmark into a white-on-dark slab and,
 * worse, punching grey boxes around product shots photographed on white.
 */
function layout(siteName: string, preheader: string, bodyHtml: string, hero?: { src: string; alt: string }): string {
  const url = siteUrl();
  return `<!doctype html>
<html lang="el">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${siteName}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#FFFFFF;font-family:${SANS};-webkit-font-smoothing:antialiased;">
    <span style="display:none;font-size:1px;color:#FFFFFF;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;">
      <tr>
        <td align="center" style="padding:0 12px;">
          <table role="presentation" width="${WIDTH}" cellpadding="0" cellspacing="0" style="max-width:${WIDTH}px;width:100%;">
            <tr>
              <td align="center" style="padding:56px 0 52px;">
                <a href="${url}" style="font-family:${SERIF};font-size:15px;letter-spacing:9px;font-weight:400;color:${INK};text-transform:uppercase;text-decoration:none;">${siteName}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 64px;">
                ${hero ? heroImage(hero.src, hero.alt) : ""}
                ${pad(bodyHtml)}
              </td>
            </tr>
            ${footer(siteName, url)}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Carries no demo disclaimer. One lived in this footer through launch and shipped on every
 * real email the shop sent, telling paying customers their order had not been charged.
 * `scripts/check-launch-placeholders.ts` never looked at this file; it does now.
 */
function footer(siteName: string, url: string): string {
  const link = (label: string, href: string) =>
    `<a href="${href}" style="color:${MUTED};text-decoration:none;font-size:10px;letter-spacing:2px;text-transform:uppercase;padding:0 10px;">${label}</a>`;
  return `<tr>
    <td align="center" style="padding:36px 24px 56px;border-top:1px solid ${HAIRLINE};">
      <p style="margin:0 0 18px;">${link("Επικοινωνία", `${url}/contact`)}${link("Επιστροφές", `${url}/returns`)}${link("Απόρρητο", `${url}/privacy`)}</p>
      <p style="margin:0;font-family:${SERIF};font-size:11px;letter-spacing:4px;color:${INK};text-transform:uppercase;">${siteName}</p>
      <p style="margin:10px 0 0;color:${MUTED};font-size:11px;line-height:1.6;">Αυτό το μήνυμα στάλθηκε αυτόματα με βάση την παραγγελία ή τον λογαριασμό σας.</p>
    </td>
  </tr>`;
}

/** Full-bleed to the 600px column — the one element allowed to be large. */
function heroImage(src: string, alt: string): string {
  return `<img src="${src}" alt="${escapeHtml(alt)}" width="${WIDTH}" style="display:block;width:100%;max-width:${WIDTH}px;height:auto;border:0;margin:0 0 44px;background-color:#F5F5F5;" />`;
}

/**
 * Horizontal breathing room for text, applied per-block rather than once on the
 * container, so an image can still run edge to edge while the copy stays inset.
 */
function pad(inner: string): string {
  return `<div style="padding:0 32px;">${inner}</div>`;
}

function eyebrow(text: string): string {
  return `<p style="margin:0 0 18px;font-size:10px;letter-spacing:3.5px;color:${MUTED};text-transform:uppercase;font-weight:400;">${text}</p>`;
}

function heading(text: string): string {
  return `<h1 style="font-family:${SERIF};font-weight:400;font-size:32px;line-height:1.25;color:${INK};margin:0 0 20px;letter-spacing:-0.2px;">${text}</h1>`;
}

function bodyText(text: string): string {
  return `<p style="color:${BODY};font-size:14px;line-height:1.8;margin:0 0 34px;">${text}</p>`;
}

function ctaButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;"><tr>
    <td style="background-color:${INK};">
      <a href="${href}" style="display:inline-block;color:#FFFFFF;text-decoration:none;font-size:11px;font-weight:400;letter-spacing:2.5px;text-transform:uppercase;padding:18px 46px;">${label}</a>
    </td>
  </tr></table>`;
}

/** A quieter secondary action — luxury mail rarely stacks two filled buttons. */
function textLink(label: string, href: string): string {
  return `<a href="${href}" style="color:${INK};text-decoration:none;border-bottom:1px solid ${INK};padding-bottom:2px;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;">${label}</a>`;
}

function sectionLabel(text: string): string {
  return `<p style="font-size:10px;letter-spacing:3px;color:${MUTED};text-transform:uppercase;margin:0 0 14px;">${text}</p>`;
}

function addressLines(address: Address): string {
  return [
    `${address.firstName} ${address.lastName}`,
    address.company,
    address.address1,
    address.address2,
    `${address.city}${address.region ? `, ${address.region}` : ""} ${address.postalCode}`,
    address.countryCode,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Product imagery at 100px rather than the old 64px thumbnail. In a fashion email the
 * photograph is the product; a thumbnail small enough to be a favicon turns the message
 * into a receipt. 4:5 matches the aspect the storefront already shoots to.
 */
function lineItemsHtml(lineItems: CartLineItem[]): string {
  return lineItems
    .map(
      (item) => `
      <tr>
        <td width="100" style="padding:24px 0;border-bottom:1px solid ${HAIRLINE};vertical-align:top;">
          <img src="${item.image.src}" alt="${escapeHtml(item.image.alt)}" width="100" height="125" style="display:block;width:100px;height:125px;object-fit:cover;border:0;background-color:#F5F5F5;" />
        </td>
        <td style="padding:24px 0 24px 22px;border-bottom:1px solid ${HAIRLINE};color:${INK};font-size:14px;line-height:1.5;vertical-align:top;">
          ${escapeHtml(item.name)}
          <span style="display:block;color:${MUTED};font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-top:8px;">${escapeHtml(item.color)} · ${escapeHtml(item.size)} · ×${item.quantity}</span>
        </td>
        <td align="right" style="padding:24px 0;border-bottom:1px solid ${HAIRLINE};color:${INK};font-size:14px;white-space:nowrap;vertical-align:top;">
          ${formatMoney({ amount: item.unitPrice.amount * item.quantity, currencyCode: item.unitPrice.currencyCode })}
        </td>
      </tr>`
    )
    .join("");
}

function totalsHtml(totals: CartTotals): string {
  const row = (label: string, money: { amount: number; currencyCode: string }) => `
    <tr>
      <td style="padding:7px 0;color:${BODY};font-size:13px;">${label}</td>
      <td align="right" style="padding:7px 0;color:${BODY};font-size:13px;">${formatMoney(money)}</td>
    </tr>`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;">
      ${row("Υποσύνολο", totals.subtotal)}
      ${totals.discountTotal.amount > 0 ? row("Έκπτωση", { amount: -totals.discountTotal.amount, currencyCode: totals.discountTotal.currencyCode }) : ""}
      ${totals.giftCardTotal.amount > 0 ? row("Δωροκάρτα", { amount: -totals.giftCardTotal.amount, currencyCode: totals.giftCardTotal.currencyCode }) : ""}
      ${row("Αποστολή", totals.shippingTotal)}
      ${totals.giftWrapTotal.amount > 0 ? row("Συσκευασία δώρου", totals.giftWrapTotal) : ""}
      ${totals.paymentFeeTotal.amount > 0 ? row("Επιβάρυνση πληρωμής", totals.paymentFeeTotal) : ""}
      <tr><td colspan="2" style="padding-top:16px;border-top:1px solid ${HAIRLINE};"></td></tr>
      <tr>
        <td style="padding:4px 0;font-family:${SERIF};font-size:17px;color:${INK};">Σύνολο</td>
        <td align="right" style="padding:4px 0;font-family:${SERIF};font-size:17px;color:${INK};">${formatMoney(totals.total)}</td>
      </tr>
      <tr>
        <td style="padding:2px 0;color:${MUTED};font-size:11px;">Περιλαμβάνεται ΦΠΑ</td>
        <td align="right" style="padding:2px 0;color:${MUTED};font-size:11px;">${formatMoney(totals.taxTotal)}</td>
      </tr>
    </table>`;
}

export function orderConfirmationEmail(input: {
  siteName: string;
  orderId: string;
  lineItems: CartLineItem[];
  totals: CartTotals;
  shippingAddress: Address;
  shippingRate: ShippingRate;
  giftWrap?: boolean;
  giftMessage?: string;
  /**
   * Payment instructions for a method that needs the customer to do something after
   * ordering — bank details for a transfer, the amount to have ready for a courier.
   * Provided by the payment provider itself (`CustomerAction.instructions`), so this
   * template never has to know which method produced them.
   */
  paymentInstructions?: { label: string; value: string }[] | null;
}): RenderedEmail {
  const { siteName, orderId, lineItems, totals, shippingAddress, shippingRate, giftWrap, giftMessage, paymentInstructions } = input;
  const subject = `Η παραγγελία σας επιβεβαιώθηκε — #${orderId.slice(-8).toUpperCase()}`;
  const giftNoteHtml =
    giftWrap && giftMessage
      ? `<p style="color:#555555;font-size:13px;font-style:italic;margin:0 0 24px;">"${giftMessage}"</p>`
      : "";
  const paymentHtml =
    paymentInstructions && paymentInstructions.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border:1px solid ${HAIRLINE};">
          <tr><td style="padding:16px 16px 4px;">
            ${sectionLabel("Στοιχεία πληρωμής")}
          </td></tr>
          ${paymentInstructions
            .map(
              (line) => `<tr>
                <td style="padding:4px 16px;color:${MUTED};font-size:12px;">${escapeHtml(line.label)}</td>
                <td align="right" style="padding:4px 16px;color:${INK};font-size:13px;">${escapeHtml(line.value)}</td>
              </tr>`
            )
            .join("")}
          <tr><td colspan="2" style="padding:12px 16px 16px;"></td></tr>
        </table>`
      : "";
  const html = layout(
    siteName,
    `Η παραγγελία σας επιβεβαιώθηκε. Σύνολο ${formatMoney(totals.total)}.`,
    `
    ${eyebrow("Επιβεβαίωση παραγγελίας")}
    ${heading("Ευχαριστούμε για την παραγγελία σας")}
    ${bodyText(`Παραγγελία #${orderId.slice(-8).toUpperCase()} — θα σας ενημερώσουμε ξανά μόλις αποσταλεί.`)}
    ${giftNoteHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lineItemsHtml(lineItems)}</table>
    ${totalsHtml(totals)}
    ${paymentHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:36px;">
      <tr>
        <td style="width:50%;vertical-align:top;">
          ${sectionLabel("Διεύθυνση αποστολής")}
          <p style="font-size:13px;color:${INK};white-space:pre-line;margin:0;">${addressLines(shippingAddress)}</p>
        </td>
        <td style="width:50%;vertical-align:top;">
          ${sectionLabel("Τρόπος παράδοσης")}
          <p style="font-size:13px;color:${INK};margin:0;">${shippingRate.label}<br/>${shippingRate.estimatedDelivery}</p>
        </td>
      </tr>
    </table>`
  );
  const text = `Ευχαριστούμε για την παραγγελία σας\n\nΠαραγγελία #${orderId.slice(-8).toUpperCase()}\n\n${lineItems
    .map((i) => `${i.name} (${i.color}, ${i.size}) x${i.quantity} — ${formatMoney({ amount: i.unitPrice.amount * i.quantity, currencyCode: i.unitPrice.currencyCode })}`)
    .join("\n")}\n\nΣύνολο: ${formatMoney(totals.total)}${
    paymentInstructions && paymentInstructions.length > 0
      ? `\n\nΣτοιχεία πληρωμής:\n${paymentInstructions.map((line) => `${line.label}: ${line.value}`).join("\n")}`
      : ""
  }\n\nΔιεύθυνση αποστολής:\n${addressLines(shippingAddress)}\n\nΠαράδοση: ${shippingRate.label} (${shippingRate.estimatedDelivery})`;
  return { subject, html, text };
}

export function shippingUpdateEmail(input: {
  siteName: string;
  orderId: string;
  status: "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  lineItems: CartLineItem[];
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
}): RenderedEmail {
  const { siteName, orderId, status, lineItems, trackingNumber, carrier, trackingUrl } = input;
  const orderNumber = `#${orderId.slice(-8).toUpperCase()}`;
  const copy: Record<typeof status, { subject: string; eyebrow: string; headline: string; body: string }> = {
    processing: {
      subject: `Η παραγγελία ${orderNumber} ετοιμάζεται`,
      eyebrow: "Ενημέρωση παραγγελίας",
      headline: "Η παραγγελία σας ετοιμάζεται",
      body: "Ετοιμάζουμε τα προϊόντα σας — θα σας ενημερώσουμε ξανά μόλις η παραγγελία αποσταλεί.",
    },
    shipped: {
      subject: `Η παραγγελία ${orderNumber} απεστάλη`,
      eyebrow: "Ενημέρωση παραγγελίας",
      headline: "Η παραγγελία σας είναι καθ' οδόν",
      body: "Το δέμα σας αναχώρησε από την αποθήκη μας. Μπορείτε να παρακολουθείτε την πορεία του ανά πάσα στιγμή από τον λογαριασμό σας.",
    },
    delivered: {
      subject: `Η παραγγελία ${orderNumber} παραδόθηκε`,
      eyebrow: "Ενημέρωση παραγγελίας",
      headline: "Η παραγγελία σας παραδόθηκε",
      body: "Ελπίζουμε να σας ενθουσιάσει. Αν κάτι δεν είναι όπως το περιμένατε, μπορείτε να ξεκινήσετε επιστροφή από τον λογαριασμό σας.",
    },
    cancelled: {
      subject: `Η παραγγελία ${orderNumber} ακυρώθηκε`,
      eyebrow: "Ενημέρωση παραγγελίας",
      headline: "Η παραγγελία σας ακυρώθηκε",
      body: "Η παραγγελία ακυρώθηκε — δεν πρόκειται να χρεωθεί ούτε να αποσταλεί.",
    },
    refunded: {
      subject: `Επιστροφή χρημάτων για την παραγγελία ${orderNumber}`,
      eyebrow: "Ενημέρωση παραγγελίας",
      headline: "Η επιστροφή χρημάτων ολοκληρώθηκε",
      body: "Η επιστροφή χρημάτων για αυτή την παραγγελία έχει πραγματοποιηθεί.",
    },
  };
  const { subject, eyebrow: eyebrowText, headline, body } = copy[status];
  const trackingHtml =
    status === "shipped" && trackingNumber
      ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;background-color:#FAFAFA;border:1px solid ${HAIRLINE};">
      <tr><td style="padding:20px 24px;">
        ${sectionLabel(carrier ?? "Παρακολούθηση")}
        <p style="font-size:14px;color:${INK};margin:0 0 10px;">${trackingNumber}</p>
        ${trackingUrl ? textLink("Παρακολούθηση δέματος", trackingUrl) : ""}
      </td></tr>
    </table>`
      : "";
  const html = layout(
    siteName,
    body,
    `
    ${eyebrow(eyebrowText)}
    ${heading(headline)}
    <p style="color:${MUTED};font-size:12px;letter-spacing:0.5px;margin:-8px 0 20px;">Παραγγελία ${orderNumber}</p>
    ${bodyText(body)}
    ${trackingHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lineItemsHtml(lineItems)}</table>`
  );
  const trackingText = status === "shipped" && trackingNumber ? `\n\n${carrier ?? "Παρακολούθηση"}: ${trackingNumber}${trackingUrl ? ` — ${trackingUrl}` : ""}` : "";
  const text = `${headline}\n\nΠαραγγελία ${orderNumber}\n\n${body}${trackingText}\n\n${lineItems.map((i) => `${i.name} (${i.color}, ${i.size}) x${i.quantity}`).join("\n")}`;
  return { subject, html, text };
}

export function referralRewardEmail(input: {
  siteName: string;
  firstName: string;
  friendFirstName: string;
  giftCardCode: string;
  giftCardAmount: { amount: number; currencyCode: string };
}): RenderedEmail {
  const { siteName, firstName, friendFirstName, giftCardCode, giftCardAmount } = input;
  const subject = `Κερδίσατε δωροκάρτα ${formatMoney(giftCardAmount)}`;
  const html = layout(
    siteName,
    `Ο/Η ${friendFirstName} έκανε την πρώτη του/της παραγγελία — ορίστε η ανταμοιβή σας.`,
    `
    ${eyebrow("Ανταμοιβή σύστασης")}
    ${heading(`Ευχαριστούμε για τη σύσταση, ${firstName}`)}
    ${bodyText(`Ο/Η ${friendFirstName} μόλις έκανε την πρώτη παραγγελία μέσω του συνδέσμου σας — ορίστε μια δωροκάρτα ${formatMoney(giftCardAmount)} ως ευχαριστώ.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;background-color:${INK};">
      <tr><td style="padding:28px;text-align:center;">
        <p style="font-size:11px;letter-spacing:2px;color:#B8B8B8;text-transform:uppercase;margin:0 0 10px;">Ο κωδικός της δωροκάρτας σας</p>
        <p style="font-family:${SERIF};font-size:22px;letter-spacing:3px;color:#FFFFFF;margin:0;">${giftCardCode}</p>
      </td></tr>
    </table>
    <p style="color:${MUTED};font-size:13px;margin:0;">Χρησιμοποιήστε τον στο ταμείο όποτε θέλετε.</p>`
  );
  const text = `Ευχαριστούμε για τη σύσταση, ${firstName}\n\nΟ/Η ${friendFirstName} μόλις έκανε την πρώτη παραγγελία μέσω του συνδέσμου σας — ορίστε μια δωροκάρτα ${formatMoney(giftCardAmount)} ως ευχαριστώ.\n\nΚωδικός: ${giftCardCode}\n\nΧρησιμοποιήστε τον στο ταμείο όποτε θέλετε.`;
  return { subject, html, text };
}

export function welcomeEmail(input: { siteName: string; firstName: string; shopUrl: string }): RenderedEmail {
  const { siteName, firstName, shopUrl } = input;
  const subject = `Καλώς ήρθατε στο ${siteName}`;
  const html = layout(
    siteName,
    `Καλώς ήρθατε στο ${siteName}, ${firstName}.`,
    `
    ${eyebrow("Καλώς ήρθατε")}
    ${heading(`Καλώς ήρθατε, ${firstName}`)}
    ${bodyText("Ο λογαριασμός σας είναι έτοιμος. Παρακολουθήστε τις παραγγελίες σας, αποθηκεύστε διευθύνσεις και δημιουργήστε τη λίστα επιθυμιών σας όποτε θέλετε.")}
    ${ctaButton("Ανακαλύψτε τη συλλογή", shopUrl)}`
  );
  const text = `Καλώς ήρθατε, ${firstName}\n\nΟ λογαριασμός σας είναι έτοιμος. Παρακολουθήστε τις παραγγελίες σας, αποθηκεύστε διευθύνσεις και δημιουργήστε τη λίστα επιθυμιών σας όποτε θέλετε.\n\n${shopUrl}`;
  return { subject, html, text };
}

export function passwordResetEmail(input: { siteName: string; resetUrl: string; expiresInMinutes: number }): RenderedEmail {
  const { siteName, resetUrl, expiresInMinutes } = input;
  const subject = "Επαναφορά κωδικού πρόσβασης";
  const html = layout(
    siteName,
    "Επαναφορά κωδικού πρόσβασης.",
    `
    ${eyebrow("Ασφάλεια λογαριασμού")}
    ${heading("Επαναφορά κωδικού πρόσβασης")}
    ${bodyText(`Λάβαμε αίτημα επαναφοράς του κωδικού πρόσβασής σας. Ο σύνδεσμος λήγει σε ${expiresInMinutes} λεπτά.`)}
    ${ctaButton("Επαναφορά κωδικού", resetUrl)}
    <p style="color:${MUTED};font-size:12px;margin:24px 0 0;">Αν δεν ζητήσατε εσείς την επαναφορά, αγνοήστε αυτό το μήνυμα.</p>`
  );
  const text = `Επαναφορά κωδικού πρόσβασης\n\nΛάβαμε αίτημα επαναφοράς του κωδικού πρόσβασής σας. Ο σύνδεσμος λήγει σε ${expiresInMinutes} λεπτά.\n\n${resetUrl}\n\nΑν δεν ζητήσατε εσείς την επαναφορά, αγνοήστε αυτό το μήνυμα.`;
  return { subject, html, text };
}

/**
 * Sent instead of creating a session when someone signs up with an already-registered
 * email — see app/api/auth/sign-up/route.ts. Deliberately does not confirm anything to
 * the *submitter* beyond the generic success response; this is what actually gets read,
 * by the real account owner, if it wasn't them.
 */
export function accountAlreadyExistsEmail(input: { siteName: string; loginUrl: string }): RenderedEmail {
  const { siteName, loginUrl } = input;
  const subject = "Κάποιος προσπάθησε να δημιουργήσει λογαριασμό με το email σας";
  const html = layout(
    siteName,
    "Έγινε προσπάθεια εγγραφής με τη διεύθυνση email σας.",
    `
    ${eyebrow("Ασφάλεια λογαριασμού")}
    ${heading("Έχετε ήδη λογαριασμό")}
    ${bodyText(`Κάποιος μόλις προσπάθησε να δημιουργήσει νέο λογαριασμό ${siteName} με αυτή τη διεύθυνση email. Αν ήσασταν εσείς, συνδεθείτε στον υπάρχοντα λογαριασμό σας — δεν έχει επηρεαστεί.`)}
    ${ctaButton("Σύνδεση", loginUrl)}
    <p style="color:${MUTED};font-size:12px;margin:24px 0 0;">Αν δεν ήσασταν εσείς, αγνοήστε αυτό το μήνυμα — δεν δημιουργήθηκε νέος λογαριασμός.</p>`
  );
  const text = `Έχετε ήδη λογαριασμό\n\nΚάποιος μόλις προσπάθησε να δημιουργήσει νέο λογαριασμό ${siteName} με αυτή τη διεύθυνση email. Αν ήσασταν εσείς, συνδεθείτε στον υπάρχοντα λογαριασμό σας.\n\n${loginUrl}\n\nΑν δεν ήσασταν εσείς, αγνοήστε αυτό το μήνυμα — δεν δημιουργήθηκε νέος λογαριασμός.`;
  return { subject, html, text };
}

/** Sent to the store's own contact address (CONTACT_EMAIL, or settings.contactEmail) — an internal notification, not a customer-facing email, so it stays plain/functional rather than getting the customer-facing editorial treatment. */
export function contactMessageNotificationEmail(input: {
  siteName: string;
  name: string;
  email: string;
  subject: string;
  message: string;
}): RenderedEmail {
  const { siteName, name, email, subject, message } = input;
  const emailSubject = `Νέο μήνυμα επικοινωνίας: ${subject}`;
  const html = layout(
    siteName,
    `Νέο μήνυμα από ${name}`,
    `
    <h1 style="font-size:22px;color:${INK};margin:0 0 8px;">Νέο μήνυμα επικοινωνίας</h1>
    <p style="color:#555555;font-size:13px;margin:0 0 4px;"><strong>Από:</strong> ${name} (${email})</p>
    <p style="color:#555555;font-size:13px;margin:0 0 20px;"><strong>Θέμα:</strong> ${subject}</p>
    <p style="color:${INK};font-size:14px;white-space:pre-line;margin:0;">${message}</p>`
  );
  const text = `Νέο μήνυμα επικοινωνίας\n\nΑπό: ${name} (${email})\nΘέμα: ${subject}\n\n${message}`;
  return { subject: emailSubject, html, text };
}

export function abandonedCartEmail(input: {
  siteName: string;
  firstName?: string;
  lineItems: CartLineItem[];
  resumeUrl: string;
}): RenderedEmail {
  const { siteName, firstName, lineItems, resumeUrl } = input;
  const greeting = firstName ? `Το σκέφτεστε ακόμη, ${firstName};` : "Το σκέφτεστε ακόμη;";
  const subject = "Αφήσατε κάτι στο καλάθι σας";
  const html = layout(
    siteName,
    "Το καλάθι σας είναι αποθηκευμένο — συνεχίστε από εκεί που μείνατε.",
    `
    ${eyebrow("Το καλάθι σας")}
    ${heading(greeting)}
    ${bodyText("Το καλάθι σας είναι ακόμη αποθηκευμένο. Οι τιμές και η διαθεσιμότητα ενδέχεται να αλλάξουν, οπότε αξίζει να επιστρέψετε σύντομα.")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lineItemsHtml(lineItems)}</table>
    <div style="margin-top:32px;">${ctaButton("Επιστροφή στο καλάθι", resumeUrl)}</div>`,
    lineItems[0] ? { src: lineItems[0].image.src, alt: lineItems[0].image.alt } : undefined
  );
  const text = `${greeting}\n\nΤο καλάθι σας είναι ακόμη αποθηκευμένο:\n\n${lineItems
    .map((i) => `${i.name} (${i.color}, ${i.size}) x${i.quantity}`)
    .join("\n")}\n\nΕπιστροφή στο καλάθι: ${resumeUrl}`;
  return { subject, html, text };
}

/**
 * Links back to the product page itself, not a "submit a review" form — this app has
 * no real review-submission mechanism (reviews are still static data/reviews.json,
 * explicitly future-ready-but-not-built), so the email is honest about what exists
 * today rather than pointing at a form that doesn't work.
 */
export function reviewRequestEmail(input: {
  siteName: string;
  orderId: string;
  lineItems: CartLineItem[];
  siteUrl: string;
}): RenderedEmail {
  const { siteName, orderId, lineItems, siteUrl } = input;
  const orderNumber = `#${orderId.slice(-8).toUpperCase()}`;
  const subject = "Πώς σας φάνηκαν;";
  const itemLinksHtml = lineItems
    .map(
      (item) => `
      <tr>
        <td width="100" style="padding:24px 0;border-bottom:1px solid ${HAIRLINE};vertical-align:top;">
          <img src="${item.image.src}" alt="${escapeHtml(item.image.alt)}" width="100" height="125" style="display:block;width:100px;height:125px;object-fit:cover;border:0;background-color:#F5F5F5;" />
        </td>
        <td style="padding:24px 0 24px 22px;border-bottom:1px solid ${HAIRLINE};color:${INK};font-size:14px;line-height:1.5;vertical-align:top;">
          <a href="${siteUrl}/products/${item.slug}" style="color:${INK};text-decoration:none;border-bottom:1px solid ${HAIRLINE};">${escapeHtml(item.name)}</a>
          <span style="display:block;color:${MUTED};font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-top:8px;">${escapeHtml(item.color)} · ${escapeHtml(item.size)}</span>
        </td>
      </tr>`
    )
    .join("");
  const html = layout(
    siteName,
    `Πώς σας φάνηκε η παραγγελία ${orderNumber};`,
    `
    ${eyebrow("Η γνώμη σας μετράει")}
    ${heading("Πώς σας φάνηκαν;")}
    ${bodyText(`Η παραγγελία ${orderNumber} παραδόθηκε πριν από λίγες ημέρες — δείτε ξανά τι παραγγείλατε ή ανακαλύψτε το επόμενο κομμάτι σας.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemLinksHtml}</table>
    <div style="margin-top:32px;">${ctaButton("Συνεχίστε τις αγορές", siteUrl)}</div>`
  );
  const text = `Πώς σας φάνηκαν;\n\nΗ παραγγελία ${orderNumber} παραδόθηκε πριν από λίγες ημέρες.\n\n${lineItems
    .map((i) => `${i.name} — ${siteUrl}/products/${i.slug}`)
    .join("\n")}\n\n${siteUrl}`;
  return { subject, html, text };
}

export function backInStockEmail(input: {
  siteName: string;
  productName: string;
  sizeName: string;
  productUrl: string;
}): RenderedEmail {
  const { siteName, productName, sizeName, productUrl } = input;
  const subject = `${productName} — ξανά διαθέσιμο`;
  const html = layout(
    siteName,
    `${productName} (${sizeName}) είναι ξανά διαθέσιμο.`,
    `
    ${eyebrow("Ξανά διαθέσιμο")}
    ${heading("Καλά νέα — επέστρεψε")}
    ${bodyText(`Το <strong>${productName}</strong> σε μέγεθος <strong>${sizeName}</strong> είναι ξανά διαθέσιμο. Τα δημοφιλή μεγέθη εξαντλούνται γρήγορα.`)}
    ${ctaButton("Δείτε το προϊόν", productUrl)}`
  );
  const text = `Καλά νέα — επέστρεψε\n\nΤο ${productName} σε μέγεθος ${sizeName} είναι ξανά διαθέσιμο.\n\n${productUrl}`;
  return { subject, html, text };
}

export function returnStatusUpdateEmail(input: {
  siteName: string;
  orderId: string;
  status: "approved" | "rejected" | "received" | "refunded";
}): RenderedEmail {
  const { siteName, orderId, status } = input;
  const orderNumber = `#${orderId.slice(-8).toUpperCase()}`;
  const copy: Record<typeof status, { subject: string; headline: string; body: string }> = {
    approved: {
      subject: `Η επιστροφή για την παραγγελία ${orderNumber} εγκρίθηκε`,
      headline: "Η επιστροφή σας εγκρίθηκε",
      body: "Συσκευάστε τα προϊόντα και στείλτε τα πίσω ακολουθώντας τις οδηγίες στον λογαριασμό σας.",
    },
    rejected: {
      subject: `Ενημέρωση για το αίτημα επιστροφής — παραγγελία ${orderNumber}`,
      headline: "Το αίτημα επιστροφής δεν εγκρίθηκε",
      body: "Δείτε τις λεπτομέρειες στον λογαριασμό σας ή επικοινωνήστε μαζί μας αν πιστεύετε ότι πρόκειται για λάθος.",
    },
    received: {
      subject: `Λάβαμε την επιστροφή σας για την παραγγελία ${orderNumber}`,
      headline: "Λάβαμε την επιστροφή σας",
      body: "Ελέγχουμε τα προϊόντα — η επιστροφή των χρημάτων σας θα ακολουθήσει σύντομα.",
    },
    refunded: {
      subject: `Η επιστροφή χρημάτων για την παραγγελία ${orderNumber} ολοκληρώθηκε`,
      headline: "Η επιστροφή χρημάτων ολοκληρώθηκε",
      body: "Το ποσό επιστράφηκε στον αρχικό τρόπο πληρωμής σας.",
    },
  };
  const { subject, headline, body } = copy[status];
  const html = layout(
    siteName,
    body,
    `
    ${eyebrow("Ενημέρωση επιστροφής")}
    ${heading(headline)}
    <p style="color:${MUTED};font-size:12px;letter-spacing:0.5px;margin:-8px 0 20px;">Παραγγελία ${orderNumber}</p>
    ${bodyText(body)}`
  );
  const text = `${headline}\n\nΠαραγγελία ${orderNumber}\n\n${body}`;
  return { subject, html, text };
}
