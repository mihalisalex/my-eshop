import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cartInclude, toCart } from "@/lib/commerce/postgres/mappers";
import { cartLineItemSchema } from "@/lib/validation/commerce";
import { getEmailProvider } from "@/lib/email";
import { abandonedCartEmail, reviewRequestEmail } from "@/lib/email/templates";
import { getSiteSettings } from "@/services/settings";
import { getSiteUrl } from "@/lib/site-url";

const ABANDONED_CART_IDLE_MS = 24 * 60 * 60 * 1000;
const REVIEW_REQUEST_DELAY_MS = 5 * 24 * 60 * 60 * 1000;

export interface FollowupSummary {
  scanned: number;
  sent: number;
  skipped: number;
}

/**
 * Only recoverable where an email is actually knowable: a signed-in customer, or a
 * guest who at least started checkout (Checkout.email). A cart that never reached
 * checkout has no email anywhere in this schema — genuinely unrecoverable, not a bug.
 */
export async function runAbandonedCartRecovery(): Promise<FollowupSummary> {
  const now = Date.now();
  const rows = await prisma.cart.findMany({
    where: { lineItems: { some: { savedForLater: false } } },
    include: {
      ...cartInclude,
      customer: { select: { email: true } },
      checkouts: { where: { status: { not: "completed" } }, orderBy: { createdAt: "desc" }, take: 1, select: { email: true } },
    },
  });

  const settings = await getSiteSettings();
  const provider = getEmailProvider();
  const siteUrl = getSiteUrl();

  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    const activeLineItems = row.lineItems.filter((item) => !item.savedForLater);
    if (activeLineItems.length === 0) {
      skipped++;
      continue;
    }

    // Idle signal is MAX(CartLineItem.addedAt), not Cart.updatedAt — the latter only
    // moves on Cart-row writes (e.g. linking a customer), not on line-item add/remove.
    const lastActivity = activeLineItems.reduce(
      (latest, item) => (item.addedAt > latest ? item.addedAt : latest),
      activeLineItems[0].addedAt
    );
    if (now - lastActivity.getTime() < ABANDONED_CART_IDLE_MS) {
      skipped++;
      continue;
    }

    const resolvedEmail = row.customer?.email ?? row.checkouts[0]?.email ?? null;
    if (!resolvedEmail) {
      skipped++;
      continue;
    }

    // A cart row is reused indefinitely (never deleted), so a plain "already sent"
    // boolean would permanently block recovery after the first email ever sent — this
    // single comparison instead re-enables eligibility whenever new activity (a later
    // addedAt) happens after the last send, i.e. a fresh abandonment episode.
    if (row.abandonedCartEmailSentAt && row.abandonedCartEmailSentAt >= lastActivity) {
      skipped++;
      continue;
    }

    try {
      const cart = toCart(row);
      const message = abandonedCartEmail({
        siteName: settings.siteName,
        lineItems: cart.lineItems.filter((item) => !item.savedForLater),
        resumeUrl: `${siteUrl}/cart?cart=${row.id}`,
      });
      await provider.send({ to: resolvedEmail, template: "abandoned-cart", ...message });
      await prisma.cart.update({ where: { id: row.id }, data: { abandonedCartEmailSentAt: new Date() } });
      sent++;
    } catch (error) {
      console.error("Failed to send abandoned-cart email", error);
      skipped++;
    }
  }

  return { scanned: rows.length, sent, skipped };
}

/**
 * Links back to the product page, not a "submit a review" form — see
 * lib/email/templates.ts's reviewRequestEmail for why (no real review-submission
 * mechanism exists in this app yet).
 */
export async function runReviewRequestFollowup(): Promise<FollowupSummary> {
  const cutoff = new Date(Date.now() - REVIEW_REQUEST_DELAY_MS);
  const orders = await prisma.order.findMany({
    where: { deliveredAt: { not: null, lte: cutoff }, reviewRequestSentAt: null },
    select: { id: true, customerEmail: true, lineItems: true },
  });

  const settings = await getSiteSettings();
  const provider = getEmailProvider();
  const siteUrl = getSiteUrl();

  let sent = 0;
  let skipped = 0;

  for (const order of orders) {
    try {
      const lineItems = z.array(cartLineItemSchema).parse(order.lineItems);
      const message = reviewRequestEmail({ siteName: settings.siteName, orderId: order.id, lineItems, siteUrl });
      await provider.send({ to: order.customerEmail, template: "review-request", ...message });
      await prisma.order.update({ where: { id: order.id }, data: { reviewRequestSentAt: new Date() } });
      sent++;
    } catch (error) {
      console.error("Failed to send review-request email", error);
      skipped++;
    }
  }

  return { scanned: orders.length, sent, skipped };
}
