import { describe, expect, it, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";

/**
 * `completeCheckout` end to end — the gap this audit has carried since day one.
 *
 * `services/concurrency-guards.test.ts` pins the DATABASE semantics the guards rest on:
 * that a conditional `UPDATE … WHERE quantity >= n` serialises writers and reports the winner
 * through its affected-row count. Necessary, and not sufficient. It proves Postgres behaves;
 * it says nothing about whether `completeCheckout` still *uses* Postgres that way. A refactor
 * back to read-check-write would leave every one of those tests green while the shop began
 * overselling.
 *
 * These call the real service. They create their own product, cart, checkout and order, and
 * delete all of it afterwards.
 *
 * SAFETY: `vitest.setup.ts` redirects the whole process onto the Neon test branch and refuses
 * to start if `TEST_DATABASE_URL` resolves to the production endpoint. It also forces
 * `EMAIL_PROVIDER=dev`, because completing a checkout sends a real confirmation otherwise.
 * Without a test branch configured these skip rather than touching the live shop.
 */

const HAS_TEST_DB = Boolean(process.env.TEST_DATABASE_URL);

const ADDRESS = {
  firstName: "E2E",
  lastName: "Tester",
  address1: "Arthur Evans 9",
  city: "Heraklion",
  postalCode: "71201",
  countryCode: "GR",
  phone: "2814001031",
};

/** Everything this file created, torn down in reverse order of creation. */
const created = { productIds: [] as string[], cartIds: [] as string[], checkoutIds: [] as string[] };

let prisma: typeof import("@/lib/prisma").prisma;
let carts: typeof import("@/services/carts");
let checkout: typeof import("@/services/checkout");

beforeAll(async () => {
  ({ prisma } = await import("@/lib/prisma"));
  carts = await import("@/services/carts");
  checkout = await import("@/services/checkout");
});

afterAll(async () => {
  if (!HAS_TEST_DB) return;
  // Orders first: they hold the FK to the checkout.
  await prisma.order.deleteMany({ where: { checkoutId: { in: created.checkoutIds } } });
  await prisma.checkout.deleteMany({ where: { id: { in: created.checkoutIds } } });
  await prisma.cart.deleteMany({ where: { id: { in: created.cartIds } } });
  await prisma.product.deleteMany({ where: { id: { in: created.productIds } } });
});

/**
 * A throwaway product with exactly `quantity` of one size.
 *
 * Its own product rather than a catalogue one: these tests deliberately drive stock to zero,
 * and doing that to a real product — even on a branch — makes the branch progressively less
 * like production and the next test's results harder to trust.
 */
async function makeProduct(quantity: number) {
  const suffix = crypto.randomUUID().slice(0, 8);
  // Borrow any existing category — the FK is Restrict, and the test has no business
  // inventing taxonomy just to own a product for ten seconds.
  const { id: categoryId } = await prisma.category.findFirstOrThrow({ select: { id: true } });
  const product = await prisma.product.create({
    data: {
      name: `E2E Test Shoe ${suffix}`,
      slug: `e2e-test-shoe-${suffix}`,
      sku: `E2E-${suffix}`,
      description: "Created by services/checkout.integration.test.ts. Safe to delete.",
      priceAmount: 50,
      currencyCode: "EUR",
      status: "active",
      gender: "women",
      inventoryPolicy: "deny",
      categoryId,
      images: [{ src: "https://example.test/e2e.jpg", alt: "E2E test" }],
      colors: { create: [{ position: 0, name: "Black", hex: "#000000" }] },
      sizes: { create: [{ position: 0, name: "38", inStock: quantity > 0, quantity }] },
    },
    include: { sizes: true },
  });
  created.productIds.push(product.id);
  return product;
}

/** A cart holding `quantity` of the product's only size, ready to be checked out. */
async function makeCartWith(productId: string, quantity = 1) {
  const cart = await carts.getOrCreateCart(null);
  created.cartIds.push(cart.id);
  await carts.addLineItem(cart.id, { productId, color: "Black", size: "38", quantity });
  return cart.id;
}

/** A checkout with everything `completeCheckout` insists on: email, address, payment method. */
async function makeCheckout(cartId: string) {
  const created_ = await checkout.createCheckout(cartId);
  created.checkoutIds.push(created_.id);
  await checkout.updateEmail(created_.id, "e2e-test@example.com");
  await checkout.updateShippingAddress(created_.id, ADDRESS);
  await checkout.setPaymentMethod(created_.id, "bank-transfer");
  return created_.id;
}

async function remainingStock(productId: string): Promise<number> {
  const size = await prisma.productSize.findFirst({ where: { productId }, select: { quantity: true } });
  return size?.quantity ?? -1;
}

describe.skipIf(!HAS_TEST_DB)("completeCheckout, against the real service", () => {
  it("places an order and decrements the stock it sold", async () => {
    const product = await makeProduct(3);
    const checkoutId = await makeCheckout(await makeCartWith(product.id, 2));

    const result = await checkout.completeCheckout(checkoutId);

    expect(result.order.id).toBeTruthy();
    expect(result.order.lineItems).toHaveLength(1);
    // The whole point: stock moved by exactly what was bought, not by one, not by none.
    expect(await remainingStock(product.id)).toBe(1);
  }, 90_000);

  it("lets exactly one of ten simultaneous buyers take the last unit", async () => {
    /**
     * The finding TEST-001 was actually about. Ten checkouts, one unit, all completed at once
     * through the real service — not ten raw UPDATEs against a scratch table.
     *
     * If `completeCheckout` is ever refactored back to read-check-write, this is the test that
     * fails. Nothing else in the repo would.
     */
    const product = await makeProduct(1);
    const checkoutIds = await Promise.all(
      Array.from({ length: 10 }, async () => makeCheckout(await makeCartWith(product.id, 1)))
    );

    const results = await Promise.allSettled(checkoutIds.map((id) => checkout.completeCheckout(id)));
    const placed = results.filter((r) => r.status === "fulfilled");

    expect(placed).toHaveLength(1);
    // Stock floors at zero. A negative here is an oversell that has already shipped.
    expect(await remainingStock(product.id)).toBe(0);

    // And the nine losers failed for the right reason rather than crashing.
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(9);
    for (const failure of rejected) {
      expect(String(failure.reason?.message ?? failure.reason)).toMatch(/stock|available|quantity|sold/i);
    }
  }, 120_000);

  it("returns the same order when the same checkout is completed twice", async () => {
    /**
     * A double-click, a retried request, or a shopper refreshing mid-payment. The second call
     * must return the first order rather than creating a second one or 500ing on the unique
     * constraint — and critically, must not decrement stock again.
     */
    const product = await makeProduct(5);
    const checkoutId = await makeCheckout(await makeCartWith(product.id, 1));

    const first = await checkout.completeCheckout(checkoutId);
    const second = await checkout.completeCheckout(checkoutId);

    expect(second.order.id).toBe(first.order.id);
    expect(await remainingStock(product.id)).toBe(4);

    const orders = await prisma.order.count({ where: { checkoutId } });
    expect(orders).toBe(1);
  }, 90_000);

  it("refuses a checkout with no payment method rather than creating a half-order", async () => {
    /**
     * The comment in `completeCheckout` says it plainly: without this an order could exist
     * with no Payment row at all — stock decremented, gift cards debited, nothing to
     * reconcile against. That is worse than a rejected checkout.
     */
    const product = await makeProduct(2);
    const cartId = await makeCartWith(product.id, 1);
    const partial = await checkout.createCheckout(cartId);
    created.checkoutIds.push(partial.id);
    await checkout.updateEmail(partial.id, "e2e-test@example.com");
    await checkout.updateShippingAddress(partial.id, ADDRESS);
    // Deliberately no setPaymentMethod.

    await expect(checkout.completeCheckout(partial.id)).rejects.toThrow(/payment method/i);

    // Nothing partial left behind: stock untouched, no order.
    expect(await remainingStock(product.id)).toBe(2);
    expect(await prisma.order.count({ where: { checkoutId: partial.id } })).toBe(0);
  }, 90_000);

  it("refuses a checkout with no address rather than shipping to nowhere", async () => {
    const product = await makeProduct(2);
    const cartId = await makeCartWith(product.id, 1);
    const partial = await checkout.createCheckout(cartId);
    created.checkoutIds.push(partial.id);
    await checkout.updateEmail(partial.id, "e2e-test@example.com");
    await checkout.setPaymentMethod(partial.id, "bank-transfer");

    await expect(checkout.completeCheckout(partial.id)).rejects.toThrow(/address|email/i);
    expect(await remainingStock(product.id)).toBe(2);
  }, 90_000);
});
