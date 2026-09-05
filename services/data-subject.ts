import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GDPR data-subject rights — Article 15 (access) and Article 17 (erasure). PRIV-002.
 *
 * `PRIV-001` treated GDPR as a retention problem and solved that. Retention is one obligation
 * among several, and the two most likely to arrive as a request from an actual person were
 * missing. The privacy policy already tells customers to email to exercise these rights, which
 * is lawful — a manual process satisfies GDPR provided it is honoured. What did not exist was
 * any way to honour it.
 *
 * The hard part is not deletion. It is deleting the right things: Greek tax law requires
 * transaction records be kept for years, so an erasure that removed orders would trade a
 * privacy breach for an accounting one. Everything here is built around that tension.
 */

/**
 * Personal data is keyed two ways in this schema and both have to be followed.
 *
 * Most tables carry `customerId`, but reviews, newsletter subscriptions and contact messages
 * are keyed by **email alone** — written by people who never made an account, or before they
 * did. An erasure that only followed the foreign key would leave a named review on a product
 * page and call the job done.
 */
export interface DataSubject {
  customerId: string | null;
  email: string;
}

export interface DataSubjectExport {
  exportedAt: string;
  subject: DataSubject;
  customer: unknown;
  addresses: unknown[];
  orders: unknown[];
  returns: unknown[];
  reviews: unknown[];
  wishlist: unknown;
  conciergeRequests: unknown[];
  backInStockRequests: unknown[];
  newsletter: unknown;
  contactMessages: unknown[];
  oauthAccounts: unknown[];
}

/** Finds the subject by email, whether or not they ever created an account. */
export async function findDataSubject(email: string): Promise<DataSubject | null> {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return null;

  const customer = await prisma.customer.findUnique({
    where: { email: normalised },
    select: { id: true, email: true },
  });
  if (customer) return { customerId: customer.id, email: customer.email };

  /**
   * No account is not the same as no data. Someone can have left a review, subscribed to the
   * newsletter, or ordered as a guest — and they hold the same rights either way.
   */
  const [review, subscriber, order, message] = await Promise.all([
    prisma.productReview.findFirst({ where: { authorEmail: normalised }, select: { id: true } }),
    prisma.newsletterSubscriber.findFirst({ where: { email: normalised }, select: { id: true } }),
    prisma.order.findFirst({ where: { customerEmail: normalised }, select: { id: true } }),
    prisma.contactMessage.findFirst({ where: { email: normalised }, select: { id: true } }),
  ]);

  if (review || subscriber || order || message) return { customerId: null, email: normalised };
  return null;
}

/**
 * Article 15: everything held about one person, in one object.
 *
 * Read-only, and deliberately generous — under Article 15 the person is entitled to the data,
 * not to a summary somebody else judged sufficient. Password hashes are the one exclusion:
 * they are not the subject's personal data in any useful sense, and handing out a hash is a
 * security risk with no privacy benefit.
 */
export async function exportDataSubject(subject: DataSubject): Promise<DataSubjectExport> {
  const byCustomer = subject.customerId ? { customerId: subject.customerId } : undefined;

  const [customer, addresses, orders, returns, reviews, wishlist, concierge, backInStock, newsletter, messages, oauth] =
    await Promise.all([
      subject.customerId
        ? prisma.customer.findUnique({
            where: { id: subject.customerId },
            // Explicit rather than `include`: a future column holding something sensitive
            // should have to be added here deliberately.
            select: {
              id: true, email: true, firstName: true, lastName: true, phone: true,
              acceptsMarketing: true, referralCode: true, createdAt: true, updatedAt: true,
            },
          })
        : null,
      byCustomer ? prisma.customerAddress.findMany({ where: byCustomer }) : [],
      prisma.order.findMany({
        where: subject.customerId
          ? { OR: [{ customerId: subject.customerId }, { customerEmail: subject.email }] }
          : { customerEmail: subject.email },
      }),
      byCustomer ? prisma.return.findMany({ where: byCustomer }) : [],
      prisma.productReview.findMany({ where: { authorEmail: subject.email } }),
      byCustomer ? prisma.wishlist.findFirst({ where: byCustomer, include: { items: true } }) : null,
      prisma.conciergeRequest.findMany({ where: { email: subject.email } }),
      prisma.backInStockRequest.findMany({ where: { email: subject.email } }),
      prisma.newsletterSubscriber.findFirst({ where: { email: subject.email } }),
      prisma.contactMessage.findMany({ where: { email: subject.email } }),
      byCustomer
        ? prisma.customerOAuthAccount.findMany({
            where: byCustomer,
            // The provider link is theirs to know about; the access token is not data about
            // them, it is a credential.
            select: { id: true, provider: true, email: true, createdAt: true },
          })
        : [],
    ]);

  return {
    exportedAt: new Date().toISOString(),
    subject,
    customer,
    addresses,
    orders,
    returns,
    reviews,
    wishlist,
    conciergeRequests: concierge,
    backInStockRequests: backInStock,
    newsletter,
    contactMessages: messages,
    oauthAccounts: oauth,
  };
}

export interface ErasureSummary {
  /** Rows deleted outright. */
  deleted: Record<string, number>;
  /** Rows kept but stripped of identity — orders, and the returns hanging off them. */
  anonymised: Record<string, number>;
  /** What was intentionally left alone, and why. Part of the record, not a footnote. */
  retained: string[];
}

/** What an erased order keeps instead of a name. Constant so the export and tests agree. */
const ERASED = {
  email: "erased@gdpr.invalid",
  name: "Erased",
} as const;

/**
 * Article 17: erasure, done as anonymisation where the law requires the record kept.
 *
 * Orders are NOT deleted. Greek tax law requires transaction records be retained for years,
 * and Article 17(3)(b) explicitly exempts processing required by a legal obligation. So the
 * order survives with its line items, totals and dates intact — the accounting facts — while
 * every field identifying a person is overwritten. That satisfies the erasure and keeps the
 * books, which is the whole difficulty of this request and the reason it should not be done
 * by hand at speed.
 *
 * Everything with no such obligation behind it is deleted outright.
 *
 * Runs in one transaction: a half-erased customer is a worse outcome than a failed request,
 * because nobody can tell by looking which half succeeded.
 */
export async function eraseDataSubject(subject: DataSubject): Promise<ErasureSummary> {
  const { customerId, email } = subject;
  const byCustomer = customerId ? { customerId } : null;

  return prisma.$transaction(async (tx) => {
    const deleted: Record<string, number> = {};
    const anonymised: Record<string, number> = {};

    // ---- Deleted outright: nothing obliges the shop to keep any of it. ----
    if (byCustomer) {
      deleted.addresses = (await tx.customerAddress.deleteMany({ where: byCustomer })).count;
      deleted.wishlistItems = (
        await tx.wishlistItem.deleteMany({ where: { wishlist: byCustomer } })
      ).count;
      deleted.wishlists = (await tx.wishlist.deleteMany({ where: byCustomer })).count;
      deleted.carts = (await tx.cart.deleteMany({ where: byCustomer })).count;
      deleted.passwordResetTokens = (await tx.passwordResetToken.deleteMany({ where: byCustomer })).count;
      deleted.oauthAccounts = (await tx.customerOAuthAccount.deleteMany({ where: byCustomer })).count;
    }
    deleted.reviews = (await tx.productReview.deleteMany({ where: { authorEmail: email } })).count;
    deleted.newsletter = (await tx.newsletterSubscriber.deleteMany({ where: { email } })).count;
    deleted.contactMessages = (await tx.contactMessage.deleteMany({ where: { email } })).count;
    deleted.conciergeRequests = (await tx.conciergeRequest.deleteMany({ where: { email } })).count;
    deleted.backInStockRequests = (await tx.backInStockRequest.deleteMany({ where: { email } })).count;

    // ---- Kept, but stripped of identity: the tax record survives, the person does not. ----
    const orderWhere = customerId
      ? { OR: [{ customerId }, { customerEmail: email }] }
      : { customerEmail: email };

    const orders = await tx.order.findMany({ where: orderWhere, select: { id: true } });
    for (const order of orders) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          customerId: null,
          customerEmail: ERASED.email,
          // The address is inside a JSON snapshot, so it is replaced wholesale rather than
          // patched — a partial overwrite would leave a street name behind.
          shippingAddress: erasedAddress(),
          billingAddress: erasedAddress(),
          giftMessage: null,
        },
      });
    }
    anonymised.orders = orders.length;

    if (byCustomer) {
      anonymised.returns = (
        await tx.return.updateMany({ where: byCustomer, data: { customerId: null, customerEmail: ERASED.email } })
      ).count;
      // Last, because everything above keys off it.
      deleted.customer = (await tx.customer.deleteMany({ where: { id: customerId! } })).count;
    }

    const summary: ErasureSummary = {
      deleted,
      anonymised,
      retained: [
        "Orders and their line items, totals and dates — required by Greek tax law and exempted by GDPR Art. 17(3)(b). Every identifying field on them has been overwritten.",
        "Returns attached to those orders, for the same reason and stripped the same way.",
        "Payment and webhook records, which reference orders rather than people; PRIV-001 already blanks their payloads at 90 days.",
      ],
    };

    logger.info("GDPR erasure completed", {
      // Never the email itself: an erasure that writes the erased address into the log has
      // not erased anything.
      subject: customerId ? `customer:${customerId}` : "guest",
      deleted: summary.deleted,
      anonymised: summary.anonymised,
    });

    return summary;
  });
}

function erasedAddress() {
  return {
    firstName: ERASED.name,
    lastName: ERASED.name,
    address1: ERASED.name,
    city: ERASED.name,
    postalCode: "00000",
    countryCode: "GR",
  };
}
