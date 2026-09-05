import { describe, expect, it, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";

/**
 * PRIV-002 — GDPR access and erasure.
 *
 * This is the most destructive code in the repo: it deletes a person's data on purpose. So it
 * is tested more heavily than the feature's size suggests, and it is tested on the Neon branch
 * (`vitest.setup.ts` refuses to run if `TEST_DATABASE_URL` resolves to production).
 *
 * The assertions people usually skip are the ones that matter most here — not "did it delete"
 * but **"did it leave alone what it must"**. An erasure that removes orders swaps a privacy
 * breach for an accounting one, and Greek tax law is not satisfied by good intentions.
 */

const HAS_TEST_DB = Boolean(process.env.TEST_DATABASE_URL);

let prisma: typeof import("@/lib/prisma").prisma;
let subjects: typeof import("@/services/data-subject");

const madeCustomerIds: string[] = [];
const madeOrderIds: string[] = [];
const madeProductIds: string[] = [];

beforeAll(async () => {
  ({ prisma } = await import("@/lib/prisma"));
  subjects = await import("@/services/data-subject");
});

afterAll(async () => {
  if (!HAS_TEST_DB) return;
  await prisma.order.deleteMany({ where: { id: { in: madeOrderIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: madeCustomerIds } } });
  await prisma.product.deleteMany({ where: { id: { in: madeProductIds } } });
});

/** A customer with the full spread of attached data, so erasure has something to miss. */
async function makeSubject() {
  const tag = crypto.randomUUID().slice(0, 8);
  const email = `gdpr-${tag}@example.test`;

  const customer = await prisma.customer.create({
    data: { email, firstName: "Test", lastName: "Subject", phone: "2810000000", acceptsMarketing: true },
  });
  madeCustomerIds.push(customer.id);

  const { id: categoryId } = await prisma.category.findFirstOrThrow({ select: { id: true } });
  const product = await prisma.product.create({
    data: {
      name: `GDPR Fixture ${tag}`, slug: `gdpr-fixture-${tag}`, sku: `GDPR-${tag}`,
      description: "Fixture for services/data-subject.test.ts.", priceAmount: 25, currencyCode: "EUR",
      status: "active", gender: "women", categoryId,
      images: [{ src: "https://example.test/x.jpg", alt: "x" }],
    },
  });
  madeProductIds.push(product.id);

  await prisma.customerAddress.create({
    data: {
      customerId: customer.id, position: 0, firstName: "Test", lastName: "Subject",
      address1: "Arthur Evans 9", city: "Heraklion", postalCode: "71201", countryCode: "GR",
    },
  });
  await prisma.productReview.create({
    data: {
      productId: product.id, rating: 5, title: "Great", body: "Very good.",
      authorName: "Test Subject", authorEmail: email, status: "approved",
    },
  });
  await prisma.newsletterSubscriber.create({ data: { email } });

  const order = await prisma.order.create({
    data: {
      checkoutId: `gdpr-checkout-${tag}`,
      customerId: customer.id,
      customerEmail: email,
      lineItems: [{ productId: product.id, name: "GDPR Fixture", quantity: 1, price: 25 }],
      totals: { total: { amount: 25, currencyCode: "EUR" } },
      shippingAddress: { firstName: "Test", lastName: "Subject", address1: "Arthur Evans 9", city: "Heraklion", postalCode: "71201", countryCode: "GR" },
      billingAddress: { firstName: "Test", lastName: "Subject", address1: "Arthur Evans 9", city: "Heraklion", postalCode: "71201", countryCode: "GR" },
      shippingRate: { id: "standard", label: "Standard", price: { amount: 0, currencyCode: "EUR" } },
      status: "confirmed",
    },
  });
  madeOrderIds.push(order.id);

  return { customer, email, product, order };
}

describe.skipIf(!HAS_TEST_DB)("GDPR data-subject rights", () => {
  it("finds a subject who has an account", async () => {
    const { customer, email } = await makeSubject();
    const found = await subjects.findDataSubject(email);
    expect(found).toEqual({ customerId: customer.id, email });
  }, 60_000);

  it("finds a subject who never made an account", async () => {
    /**
     * Someone who left a review or subscribed to the newsletter holds the same rights as a
     * registered customer. Following only the foreign key would tell them "we have nothing
     * about you" while their name sat on a product page.
     */
    const tag = crypto.randomUUID().slice(0, 8);
    const email = `guest-${tag}@example.test`;
    await prisma.newsletterSubscriber.create({ data: { email } });

    const found = await subjects.findDataSubject(email);
    expect(found).toEqual({ customerId: null, email });

    await prisma.newsletterSubscriber.deleteMany({ where: { email } });
  }, 60_000);

  it("returns null for someone genuinely unknown", async () => {
    expect(await subjects.findDataSubject(`nobody-${crypto.randomUUID()}@example.test`)).toBeNull();
  }, 60_000);

  it("exports every category of data held, and never the password hash", async () => {
    const { customer, email } = await makeSubject();
    const dump = await subjects.exportDataSubject({ customerId: customer.id, email });

    expect(dump.customer).toMatchObject({ email, firstName: "Test" });
    expect(dump.addresses).toHaveLength(1);
    expect(dump.orders).toHaveLength(1);
    expect(dump.reviews).toHaveLength(1);
    expect(dump.newsletter).not.toBeNull();

    // Article 15 entitles the person to their data — not to a credential.
    expect(JSON.stringify(dump)).not.toContain("passwordHash");
  }, 60_000);

  it("erases the person while keeping the order the tax authority requires", async () => {
    const { customer, email, order } = await makeSubject();

    const summary = await subjects.eraseDataSubject({ customerId: customer.id, email });

    // Gone.
    expect(await prisma.customer.findUnique({ where: { id: customer.id } })).toBeNull();
    expect(await prisma.productReview.count({ where: { authorEmail: email } })).toBe(0);
    expect(await prisma.newsletterSubscriber.count({ where: { email } })).toBe(0);
    expect(await prisma.customerAddress.count({ where: { customerId: customer.id } })).toBe(0);

    // Kept — and this is the assertion that matters. The order still exists.
    const kept = await prisma.order.findUnique({ where: { id: order.id } });
    expect(kept).not.toBeNull();
    expect(summary.anonymised.orders).toBe(1);

    // But carries nothing identifying.
    expect(kept!.customerId).toBeNull();
    expect(kept!.customerEmail).not.toBe(email);
    expect(JSON.stringify(kept!.shippingAddress)).not.toContain("Arthur Evans");
    expect(JSON.stringify(kept!.shippingAddress)).not.toContain("Subject");

    // And the accounting facts survive intact, which is the entire point of not deleting it.
    expect(kept!.totals).not.toBeNull();
    expect(kept!.lineItems).not.toBeNull();
    expect(kept!.status).toBe("confirmed");
  }, 90_000);

  it("says plainly what it retained rather than leaving it implied", async () => {
    const { customer, email } = await makeSubject();
    const summary = await subjects.eraseDataSubject({ customerId: customer.id, email });

    // The operator answering the request has to be able to tell the person what was kept and
    // on what grounds. A summary that only counts deletions cannot do that.
    expect(summary.retained.join(" ")).toMatch(/tax law/i);
    expect(summary.retained.join(" ")).toMatch(/17\(3\)\(b\)/);
  }, 90_000);

  it("erases a guest who has an order but no account", async () => {
    // Guest checkout is a real path in this shop, and the erasure has to follow email alone.
    const { email, order, customer } = await makeSubject();
    await prisma.order.update({ where: { id: order.id }, data: { customerId: null } });
    await prisma.customer.delete({ where: { id: customer.id } });

    const summary = await subjects.eraseDataSubject({ customerId: null, email });

    expect(summary.anonymised.orders).toBe(1);
    const kept = await prisma.order.findUnique({ where: { id: order.id } });
    expect(kept).not.toBeNull();
    expect(kept!.customerEmail).not.toBe(email);
  }, 90_000);
});
