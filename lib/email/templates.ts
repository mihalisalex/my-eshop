import { formatMoney } from "@/lib/format";
import type { Address, CartLineItem, CartTotals, ShippingRate } from "@/lib/commerce/types";

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Table-based layout with inline styles, not a <style> block — the only markup
 * pattern that renders consistently across real email clients (Gmail/Outlook both
 * strip <head> styles). Kept deliberately close to the storefront's black/white
 * palette (see globals.css's luxe-* tokens) without trying to share code with it,
 * since email CSS and web CSS are different enough dialects that "sharing" would
 * just mean constantly working around what email clients don't support.
 */
function layout(siteName: string, preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#F5F5F5;font-family:Helvetica,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:#F5F5F5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F5F5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;">
            <tr>
              <td style="padding:32px 40px 24px;border-bottom:1px solid #111111;">
                <span style="font-size:20px;letter-spacing:2px;font-weight:600;color:#111111;text-transform:uppercase;">${siteName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;border-top:1px solid #F5F5F5;color:#555555;font-size:12px;">
                ${siteName} — this is a demo store. No real order was charged.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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

function lineItemsHtml(lineItems: CartLineItem[]): string {
  return lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #F5F5F5;color:#111111;font-size:14px;">
          ${item.name}<br/>
          <span style="color:#555555;font-size:12px;">${item.color} · ${item.size} · Qty ${item.quantity}</span>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid #F5F5F5;color:#111111;font-size:14px;white-space:nowrap;">
          ${formatMoney({ amount: item.unitPrice.amount * item.quantity, currencyCode: item.unitPrice.currencyCode })}
        </td>
      </tr>`
    )
    .join("");
}

function totalsHtml(totals: CartTotals): string {
  const row = (label: string, money: { amount: number; currencyCode: string }, bold = false) => `
    <tr>
      <td style="padding:4px 0;color:${bold ? "#111111" : "#555555"};font-size:${bold ? "15px" : "13px"};font-weight:${bold ? "600" : "400"};">${label}</td>
      <td align="right" style="padding:4px 0;color:${bold ? "#111111" : "#555555"};font-size:${bold ? "15px" : "13px"};font-weight:${bold ? "600" : "400"};">${formatMoney(money)}</td>
    </tr>`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      ${row("Subtotal", totals.subtotal)}
      ${totals.discountTotal.amount > 0 ? row("Discount", { amount: -totals.discountTotal.amount, currencyCode: totals.discountTotal.currencyCode }) : ""}
      ${totals.giftCardTotal.amount > 0 ? row("Gift Card", { amount: -totals.giftCardTotal.amount, currencyCode: totals.giftCardTotal.currencyCode }) : ""}
      ${row("Shipping", totals.shippingTotal)}
      ${totals.giftWrapTotal.amount > 0 ? row("Gift Wrapping", totals.giftWrapTotal) : ""}
      ${row("Tax", totals.taxTotal)}
      ${row("Total", totals.total, true)}
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
}): RenderedEmail {
  const { siteName, orderId, lineItems, totals, shippingAddress, shippingRate, giftWrap, giftMessage } = input;
  const subject = `Order confirmed — #${orderId.slice(-8).toUpperCase()}`;
  const giftNoteHtml =
    giftWrap && giftMessage
      ? `<p style="color:#555555;font-size:13px;margin:0 0 24px;"><strong>Gift note:</strong> "${giftMessage}"</p>`
      : "";
  const html = layout(
    siteName,
    `Your order is confirmed. Total ${formatMoney(totals.total)}.`,
    `
    <h1 style="font-size:22px;color:#111111;margin:0 0 8px;">Thank you for your order</h1>
    <p style="color:#555555;font-size:14px;margin:0 0 24px;">Order #${orderId.slice(-8).toUpperCase()} — we'll email you again once it ships.</p>
    ${giftNoteHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lineItemsHtml(lineItems)}</table>
    ${totalsHtml(totals)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
      <tr>
        <td style="width:50%;vertical-align:top;">
          <p style="font-size:11px;letter-spacing:1px;color:#555555;text-transform:uppercase;margin:0 0 8px;">Shipping to</p>
          <p style="font-size:13px;color:#111111;white-space:pre-line;margin:0;">${addressLines(shippingAddress)}</p>
        </td>
        <td style="width:50%;vertical-align:top;">
          <p style="font-size:11px;letter-spacing:1px;color:#555555;text-transform:uppercase;margin:0 0 8px;">Delivery method</p>
          <p style="font-size:13px;color:#111111;margin:0;">${shippingRate.label}<br/>${shippingRate.estimatedDelivery}</p>
        </td>
      </tr>
    </table>`
  );
  const text = `Thank you for your order\n\nOrder #${orderId.slice(-8).toUpperCase()}\n\n${lineItems
    .map((i) => `${i.name} (${i.color}, ${i.size}) x${i.quantity} — ${formatMoney({ amount: i.unitPrice.amount * i.quantity, currencyCode: i.unitPrice.currencyCode })}`)
    .join("\n")}\n\nTotal: ${formatMoney(totals.total)}\n\nShipping to:\n${addressLines(shippingAddress)}\n\nDelivery: ${shippingRate.label} (${shippingRate.estimatedDelivery})`;
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
  const copy: Record<typeof status, { subject: string; headline: string; body: string }> = {
    processing: {
      subject: `Order ${orderNumber} is being prepared`,
      headline: "Your order is being prepared",
      body: "We're picking and packing your items now — we'll email you again as soon as it ships.",
    },
    shipped: {
      subject: `Order ${orderNumber} has shipped`,
      headline: "Your order is on its way",
      body: "Your package has left our warehouse. You can check its status any time from your account.",
    },
    delivered: {
      subject: `Order ${orderNumber} was delivered`,
      headline: "Your order has been delivered",
      body: "We hope you love it. If anything's not right, you can start a return from your account.",
    },
    cancelled: {
      subject: `Order ${orderNumber} was cancelled`,
      headline: "Your order has been cancelled",
      body: "This order has been cancelled and will not be charged or shipped.",
    },
    refunded: {
      subject: `Order ${orderNumber} was refunded`,
      headline: "Your order has been refunded",
      body: "A refund for this order has been processed.",
    },
  };
  const { subject, headline, body } = copy[status];
  const trackingHtml =
    status === "shipped" && trackingNumber
      ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:#F5F5F5;">
      <tr><td style="padding:16px 20px;">
        <p style="font-size:11px;letter-spacing:1px;color:#555555;text-transform:uppercase;margin:0 0 6px;">${carrier ?? "Tracking"}</p>
        <p style="font-size:14px;color:#111111;margin:0 0 10px;">${trackingNumber}</p>
        ${trackingUrl ? `<a href="${trackingUrl}" style="font-size:13px;color:#111111;text-decoration:underline;">Track your package</a>` : ""}
      </td></tr>
    </table>`
      : "";
  const html = layout(
    siteName,
    body,
    `
    <h1 style="font-size:22px;color:#111111;margin:0 0 8px;">${headline}</h1>
    <p style="color:#555555;font-size:14px;margin:0 0 24px;">Order ${orderNumber}</p>
    <p style="color:#111111;font-size:14px;margin:0 0 24px;">${body}</p>
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
    <h1 style="font-size:22px;color:#111111;margin:0 0 8px;">Thanks for the referral, ${firstName}</h1>
    <p style="color:#555555;font-size:14px;margin:0 0 24px;">${friendFirstName} just placed their first order using your link — here's a ${formatMoney(giftCardAmount)} gift card as a thank you.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:#F5F5F5;">
      <tr><td style="padding:20px;text-align:center;">
        <p style="font-size:11px;letter-spacing:1px;color:#555555;text-transform:uppercase;margin:0 0 8px;">Your gift card code</p>
        <p style="font-size:20px;letter-spacing:2px;color:#111111;margin:0;font-weight:600;">${giftCardCode}</p>
      </td></tr>
    </table>
    <p style="color:#555555;font-size:13px;margin:0;">Apply it at checkout any time.</p>`
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
    <h1 style="font-size:22px;color:#111111;margin:0 0 8px;">Welcome, ${firstName}</h1>
    <p style="color:#555555;font-size:14px;margin:0 0 24px;">Your account is ready. Track orders, save addresses, and build your wishlist any time from your account.</p>
    <a href="${shopUrl}" style="display:inline-block;background-color:#111111;color:#FFFFFF;text-decoration:none;font-size:13px;letter-spacing:1px;text-transform:uppercase;padding:14px 32px;">Start Shopping</a>`
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
    <h1 style="font-size:22px;color:#111111;margin:0 0 8px;">Reset your password</h1>
    <p style="color:#555555;font-size:14px;margin:0 0 24px;">We received a request to reset your password. This link expires in ${expiresInMinutes} minutes.</p>
    <a href="${resetUrl}" style="display:inline-block;background-color:#111111;color:#FFFFFF;text-decoration:none;font-size:13px;letter-spacing:1px;text-transform:uppercase;padding:14px 32px;">Reset Password</a>
    <p style="color:#555555;font-size:12px;margin:24px 0 0;">If you didn't request this, you can safely ignore this email.</p>`
  );
  const text = `Reset your password\n\nWe received a request to reset your password. This link expires in ${expiresInMinutes} minutes.\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;
  return { subject, html, text };
}

/** Sent to the store's own contact address (CONTACT_EMAIL, or settings.contactEmail) — an internal notification, not a customer-facing email. */
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
    <h1 style="font-size:22px;color:#111111;margin:0 0 8px;">New contact message</h1>
    <p style="color:#555555;font-size:13px;margin:0 0 4px;"><strong>From:</strong> ${name} (${email})</p>
    <p style="color:#555555;font-size:13px;margin:0 0 20px;"><strong>Topic:</strong> ${subject}</p>
    <p style="color:#111111;font-size:14px;white-space:pre-line;margin:0;">${message}</p>`
  );
  const text = `New contact message\n\nFrom: ${name} (${email})\nTopic: ${subject}\n\n${message}`;
  return { subject: emailSubject, html, text };
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
    <h1 style="font-size:22px;color:#111111;margin:0 0 8px;">${headline}</h1>
    <p style="color:#555555;font-size:14px;margin:0 0 24px;">Order ${orderNumber}</p>
    <p style="color:#111111;font-size:14px;margin:0;">${body}</p>`
  );
  const text = `${headline}\n\nOrder ${orderNumber}\n\n${body}`;
  return { subject, html, text };
}
