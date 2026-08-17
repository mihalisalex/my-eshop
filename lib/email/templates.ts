import { formatMoney } from "@/lib/format";
import type { Address, CartLineItem, CartTotals, ShippingRate } from "@/lib/commerce/types";

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const INK = "#111111";
const MUTED = "#8A8A8A";
const HAIRLINE = "#EDEDED";

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
 * strip <head> styles). Editorial treatment (black masthead, serif display type,
 * generous whitespace) deliberately mirrors the storefront's own luxury-editorial
 * design language (see app/globals.css's font-heading + luxe-* tokens) without
 * sharing code with it — email CSS and web CSS are different enough dialects that
 * "sharing" would just mean constantly working around what email clients don't support.
 */
function layout(siteName: string, preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#EDEDED;font-family:Helvetica,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:#EDEDED;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EDEDED;padding:48px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;">
            <tr>
              <td align="center" style="padding:44px 40px 36px;background-color:${INK};">
                <span style="font-family:${SERIF};font-size:21px;letter-spacing:6px;font-weight:400;color:#FFFFFF;text-transform:uppercase;">${siteName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:48px 44px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 40px;border-top:1px solid ${HAIRLINE};">
                <p style="margin:0;font-family:${SERIF};font-size:11px;letter-spacing:2px;color:${MUTED};text-transform:uppercase;">${siteName}</p>
                <p style="margin:8px 0 0;color:#B8B8B8;font-size:11px;">This is a demo store — no real order was charged.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function eyebrow(text: string): string {
  return `<p style="margin:0 0 10px;font-size:11px;letter-spacing:2px;color:${MUTED};text-transform:uppercase;">${text}</p>`;
}

function heading(text: string): string {
  return `<h1 style="font-family:${SERIF};font-weight:400;font-size:26px;line-height:1.3;color:${INK};margin:0 0 14px;">${text}</h1>`;
}

function bodyText(text: string): string {
  return `<p style="color:#555555;font-size:14px;line-height:1.65;margin:0 0 28px;">${text}</p>`;
}

function ctaButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background-color:${INK};color:#FFFFFF;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;padding:16px 40px;">${label}</a>`;
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

/** Each line item gets a real product thumbnail — a fashion email with no imagery at all was the single biggest "boring" complaint to fix. */
function lineItemsHtml(lineItems: CartLineItem[]): string {
  return lineItems
    .map(
      (item) => `
      <tr>
        <td width="64" style="padding:16px 0;border-bottom:1px solid ${HAIRLINE};vertical-align:top;">
          <img src="${item.image.src}" alt="${item.image.alt}" width="64" height="80" style="display:block;width:64px;height:80px;object-fit:cover;background-color:#F5F5F5;" />
        </td>
        <td style="padding:16px 0 16px 16px;border-bottom:1px solid ${HAIRLINE};color:${INK};font-size:14px;vertical-align:top;">
          ${item.name}<br/>
          <span style="color:${MUTED};font-size:12px;">${item.color} · ${item.size} · Qty ${item.quantity}</span>
        </td>
        <td align="right" style="padding:16px 0;border-bottom:1px solid ${HAIRLINE};color:${INK};font-size:14px;white-space:nowrap;vertical-align:top;">
          ${formatMoney({ amount: item.unitPrice.amount * item.quantity, currencyCode: item.unitPrice.currencyCode })}
        </td>
      </tr>`
    )
    .join("");
}

function totalsHtml(totals: CartTotals): string {
  const row = (label: string, money: { amount: number; currencyCode: string }, bold = false) => `
    <tr>
      <td style="padding:5px 0;color:${bold ? INK : "#555555"};font-size:${bold ? "15px" : "13px"};font-weight:${bold ? "600" : "400"};">${label}</td>
      <td align="right" style="padding:5px 0;color:${bold ? INK : "#555555"};font-size:${bold ? "15px" : "13px"};font-weight:${bold ? "600" : "400"};">${formatMoney(money)}</td>
    </tr>`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      ${row("Subtotal", totals.subtotal)}
      ${totals.discountTotal.amount > 0 ? row("Discount", { amount: -totals.discountTotal.amount, currencyCode: totals.discountTotal.currencyCode }) : ""}
      ${totals.giftCardTotal.amount > 0 ? row("Gift Card", { amount: -totals.giftCardTotal.amount, currencyCode: totals.giftCardTotal.currencyCode }) : ""}
      ${row("Shipping", totals.shippingTotal)}
      ${totals.giftWrapTotal.amount > 0 ? row("Gift Wrapping", totals.giftWrapTotal) : ""}
      ${totals.paymentFeeTotal.amount > 0 ? row("Payment Fee", totals.paymentFeeTotal) : ""}
      <tr><td colspan="2" style="padding-top:10px;border-top:1px solid ${HAIRLINE};"></td></tr>
      ${row("Total", totals.total, true)}
      ${row("Includes VAT", totals.taxTotal)}
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
  const subject = `Order confirmed — #${orderId.slice(-8).toUpperCase()}`;
  const giftNoteHtml =
    giftWrap && giftMessage
      ? `<p style="color:#555555;font-size:13px;font-style:italic;margin:0 0 24px;">"${giftMessage}"</p>`
      : "";
  const paymentHtml =
    paymentInstructions && paymentInstructions.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border:1px solid ${HAIRLINE};">
          <tr><td style="padding:16px 16px 4px;">
            <p style="font-size:11px;letter-spacing:1px;color:${MUTED};text-transform:uppercase;margin:0 0 12px;">Payment details</p>
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
    `Your order is confirmed. Total ${formatMoney(totals.total)}.`,
    `
    ${eyebrow("Order Confirmation")}
    ${heading("Thank you for your order")}
    ${bodyText(`Order #${orderId.slice(-8).toUpperCase()} — we'll email you again once it ships.`)}
    ${giftNoteHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lineItemsHtml(lineItems)}</table>
    ${totalsHtml(totals)}
    ${paymentHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:36px;">
      <tr>
        <td style="width:50%;vertical-align:top;">
          <p style="font-size:11px;letter-spacing:1px;color:${MUTED};text-transform:uppercase;margin:0 0 8px;">Shipping to</p>
          <p style="font-size:13px;color:${INK};white-space:pre-line;margin:0;">${addressLines(shippingAddress)}</p>
        </td>
        <td style="width:50%;vertical-align:top;">
          <p style="font-size:11px;letter-spacing:1px;color:${MUTED};text-transform:uppercase;margin:0 0 8px;">Delivery method</p>
          <p style="font-size:13px;color:${INK};margin:0;">${shippingRate.label}<br/>${shippingRate.estimatedDelivery}</p>
        </td>
      </tr>
    </table>`
  );
  const text = `Thank you for your order\n\nOrder #${orderId.slice(-8).toUpperCase()}\n\n${lineItems
    .map((i) => `${i.name} (${i.color}, ${i.size}) x${i.quantity} — ${formatMoney({ amount: i.unitPrice.amount * i.quantity, currencyCode: i.unitPrice.currencyCode })}`)
    .join("\n")}\n\nTotal: ${formatMoney(totals.total)}${
    paymentInstructions && paymentInstructions.length > 0
      ? `\n\nPayment details:\n${paymentInstructions.map((line) => `${line.label}: ${line.value}`).join("\n")}`
      : ""
  }\n\nShipping to:\n${addressLines(shippingAddress)}\n\nDelivery: ${shippingRate.label} (${shippingRate.estimatedDelivery})`;
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
      subject: `Order ${orderNumber} is being prepared`,
      eyebrow: "Order Update",
      headline: "Your order is being prepared",
      body: "We're picking and packing your items now — we'll email you again as soon as it ships.",
    },
    shipped: {
      subject: `Order ${orderNumber} has shipped`,
      eyebrow: "Order Update",
      headline: "Your order is on its way",
      body: "Your package has left our warehouse. You can check its status any time from your account.",
    },
    delivered: {
      subject: `Order ${orderNumber} was delivered`,
      eyebrow: "Order Update",
      headline: "Your order has been delivered",
      body: "We hope you love it. If anything's not right, you can start a return from your account.",
    },
    cancelled: {
      subject: `Order ${orderNumber} was cancelled`,
      eyebrow: "Order Update",
      headline: "Your order has been cancelled",
      body: "This order has been cancelled and will not be charged or shipped.",
    },
    refunded: {
      subject: `Order ${orderNumber} was refunded`,
      eyebrow: "Order Update",
      headline: "Your order has been refunded",
      body: "A refund for this order has been processed.",
    },
  };
  const { subject, eyebrow: eyebrowText, headline, body } = copy[status];
  const trackingHtml =
    status === "shipped" && trackingNumber
      ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;background-color:#FAFAFA;border:1px solid ${HAIRLINE};">
      <tr><td style="padding:20px 24px;">
        <p style="font-size:11px;letter-spacing:1px;color:${MUTED};text-transform:uppercase;margin:0 0 6px;">${carrier ?? "Tracking"}</p>
        <p style="font-size:14px;color:${INK};margin:0 0 10px;">${trackingNumber}</p>
        ${trackingUrl ? `<a href="${trackingUrl}" style="font-size:13px;color:${INK};text-decoration:underline;">Track your package</a>` : ""}
      </td></tr>
    </table>`
      : "";
  const html = layout(
    siteName,
    body,
    `
    ${eyebrow(eyebrowText)}
    ${heading(headline)}
    <p style="color:${MUTED};font-size:12px;letter-spacing:0.5px;margin:-8px 0 20px;">Order ${orderNumber}</p>
    ${bodyText(body)}
    ${trackingHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lineItemsHtml(lineItems)}</table>`
  );
  const trackingText = status === "shipped" && trackingNumber ? `\n\n${carrier ?? "Tracking"}: ${trackingNumber}${trackingUrl ? ` — ${trackingUrl}` : ""}` : "";
  const text = `${headline}\n\nOrder ${orderNumber}\n\n${body}${trackingText}\n\n${lineItems.map((i) => `${i.name} (${i.color}, ${i.size}) x${i.quantity}`).join("\n")}`;
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
  const subject = `You earned a ${formatMoney(giftCardAmount)} gift card`;
  const html = layout(
    siteName,
    `${friendFirstName} just placed their first order — here's your reward.`,
    `
    ${eyebrow("Referral Reward")}
    ${heading(`Thanks for the referral, ${firstName}`)}
    ${bodyText(`${friendFirstName} just placed their first order using your link — here's a ${formatMoney(giftCardAmount)} gift card as a thank you.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;background-color:${INK};">
      <tr><td style="padding:28px;text-align:center;">
        <p style="font-size:11px;letter-spacing:2px;color:#B8B8B8;text-transform:uppercase;margin:0 0 10px;">Your gift card code</p>
        <p style="font-family:${SERIF};font-size:22px;letter-spacing:3px;color:#FFFFFF;margin:0;">${giftCardCode}</p>
      </td></tr>
    </table>
    <p style="color:${MUTED};font-size:13px;margin:0;">Apply it at checkout any time.</p>`
  );
  const text = `Thanks for the referral, ${firstName}\n\n${friendFirstName} just placed their first order using your link — here's a ${formatMoney(giftCardAmount)} gift card as a thank you.\n\nCode: ${giftCardCode}\n\nApply it at checkout any time.`;
  return { subject, html, text };
}

export function welcomeEmail(input: { siteName: string; firstName: string; shopUrl: string }): RenderedEmail {
  const { siteName, firstName, shopUrl } = input;
  const subject = `Welcome to ${siteName}`;
  const html = layout(
    siteName,
    `Welcome to ${siteName}, ${firstName}.`,
    `
    ${eyebrow("Welcome")}
    ${heading(`Welcome, ${firstName}`)}
    ${bodyText("Your account is ready. Track orders, save addresses, and build your wishlist any time from your account.")}
    ${ctaButton("Start Shopping", shopUrl)}`
  );
  const text = `Welcome, ${firstName}\n\nYour account is ready. Track orders, save addresses, and build your wishlist any time from your account.\n\n${shopUrl}`;
  return { subject, html, text };
}

export function passwordResetEmail(input: { siteName: string; resetUrl: string; expiresInMinutes: number }): RenderedEmail {
  const { siteName, resetUrl, expiresInMinutes } = input;
  const subject = "Reset your password";
  const html = layout(
    siteName,
    "Reset your password.",
    `
    ${eyebrow("Account Security")}
    ${heading("Reset your password")}
    ${bodyText(`We received a request to reset your password. This link expires in ${expiresInMinutes} minutes.`)}
    ${ctaButton("Reset Password", resetUrl)}
    <p style="color:${MUTED};font-size:12px;margin:24px 0 0;">If you didn't request this, you can safely ignore this email.</p>`
  );
  const text = `Reset your password\n\nWe received a request to reset your password. This link expires in ${expiresInMinutes} minutes.\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;
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
  const subject = "Someone tried to create an account with your email";
  const html = layout(
    siteName,
    "A sign-up attempt used your email address.",
    `
    ${eyebrow("Account Security")}
    ${heading("You already have an account")}
    ${bodyText(`Someone just tried to create a new ${siteName} account using this email address. If that was you, sign in instead — your existing account is unaffected.`)}
    ${ctaButton("Sign In", loginUrl)}
    <p style="color:${MUTED};font-size:12px;margin:24px 0 0;">If you didn't try this, you can safely ignore this email — no account was created.</p>`
  );
  const text = `You already have an account\n\nSomeone just tried to create a new ${siteName} account using this email address. If that was you, sign in instead.\n\n${loginUrl}\n\nIf you didn't try this, you can safely ignore this email — no account was created.`;
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
  const emailSubject = `New contact message: ${subject}`;
  const html = layout(
    siteName,
    `New message from ${name}`,
    `
    <h1 style="font-size:22px;color:${INK};margin:0 0 8px;">New contact message</h1>
    <p style="color:#555555;font-size:13px;margin:0 0 4px;"><strong>From:</strong> ${name} (${email})</p>
    <p style="color:#555555;font-size:13px;margin:0 0 20px;"><strong>Topic:</strong> ${subject}</p>
    <p style="color:${INK};font-size:14px;white-space:pre-line;margin:0;">${message}</p>`
  );
  const text = `New contact message\n\nFrom: ${name} (${email})\nTopic: ${subject}\n\n${message}`;
  return { subject: emailSubject, html, text };
}

export function abandonedCartEmail(input: {
  siteName: string;
  firstName?: string;
  lineItems: CartLineItem[];
  resumeUrl: string;
}): RenderedEmail {
  const { siteName, firstName, lineItems, resumeUrl } = input;
  const greeting = firstName ? `Still thinking it over, ${firstName}?` : "Still thinking it over?";
  const subject = "You left something in your bag";
  const html = layout(
    siteName,
    "Your bag is still saved — pick up right where you left off.",
    `
    ${eyebrow("Still Shopping?")}
    ${heading(greeting)}
    ${bodyText("Your bag is still saved. Prices and availability aren't guaranteed to hold, so it's worth coming back soon.")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lineItemsHtml(lineItems)}</table>
    <div style="margin-top:32px;">${ctaButton("Return to Your Bag", resumeUrl)}</div>`
  );
  const text = `${greeting}\n\nYour bag is still saved:\n\n${lineItems
    .map((i) => `${i.name} (${i.color}, ${i.size}) x${i.quantity}`)
    .join("\n")}\n\nReturn to your bag: ${resumeUrl}`;
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
  const subject = "How's everything fitting?";
  const itemLinksHtml = lineItems
    .map(
      (item) => `
      <tr>
        <td width="64" style="padding:16px 0;border-bottom:1px solid ${HAIRLINE};vertical-align:top;">
          <img src="${item.image.src}" alt="${item.image.alt}" width="64" height="80" style="display:block;width:64px;height:80px;object-fit:cover;background-color:#F5F5F5;" />
        </td>
        <td style="padding:16px 0 16px 16px;border-bottom:1px solid ${HAIRLINE};color:${INK};font-size:14px;vertical-align:top;">
          <a href="${siteUrl}/products/${item.slug}" style="color:${INK};text-decoration:underline;">${item.name}</a><br/>
          <span style="color:${MUTED};font-size:12px;">${item.color} · ${item.size}</span>
        </td>
      </tr>`
    )
    .join("");
  const html = layout(
    siteName,
    `How's your order ${orderNumber} working out?`,
    `
    ${eyebrow("Tell Us What You Think")}
    ${heading("How's everything fitting?")}
    ${bodyText(`Order ${orderNumber} was delivered a few days ago — take another look at what you ordered, or start shopping your next piece.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemLinksHtml}</table>
    <div style="margin-top:32px;">${ctaButton("Continue Shopping", siteUrl)}</div>`
  );
  const text = `How's everything fitting?\n\nOrder ${orderNumber} was delivered a few days ago.\n\n${lineItems
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
  const subject = `${productName} is back in stock`;
  const html = layout(
    siteName,
    `${productName} (${sizeName}) is back in stock.`,
    `
    ${eyebrow("Back In Stock")}
    ${heading("Good news — it's back")}
    ${bodyText(`<strong>${productName}</strong> in size <strong>${sizeName}</strong> is back in stock. Popular sizes tend to sell out again quickly.`)}
    ${ctaButton("Shop Now", productUrl)}`
  );
  const text = `Good news — it's back\n\n${productName} in size ${sizeName} is back in stock.\n\n${productUrl}`;
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
      subject: `Return approved for order ${orderNumber}`,
      headline: "Your return has been approved",
      body: "Pack up the item(s) and send them back using the instructions in your account.",
    },
    rejected: {
      subject: `Return request update for order ${orderNumber}`,
      headline: "Your return request wasn't approved",
      body: "Check your account for details, or reach out if you think this is a mistake.",
    },
    received: {
      subject: `We received your return for order ${orderNumber}`,
      headline: "We've received your return",
      body: "We're inspecting the item(s) now — your refund will follow shortly.",
    },
    refunded: {
      subject: `Refund processed for order ${orderNumber}`,
      headline: "Your refund has been processed",
      body: "The refund for this return has been issued to your original payment method.",
    },
  };
  const { subject, headline, body } = copy[status];
  const html = layout(
    siteName,
    body,
    `
    ${eyebrow("Return Update")}
    ${heading(headline)}
    <p style="color:${MUTED};font-size:12px;letter-spacing:0.5px;margin:-8px 0 20px;">Order ${orderNumber}</p>
    ${bodyText(body)}`
  );
  const text = `${headline}\n\nOrder ${orderNumber}\n\n${body}`;
  return { subject, html, text };
}
