import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { cartInclude, toCart, toCheckout, toJsonInput, toOrder } from "@/lib/commerce/postgres/mappers";
import { resolveCartAmounts } from "@/lib/commerce/postgres/cart-totals";
import { storedAddressSchema } from "@/lib/validation/checkout";
import { shippingRateSchema } from "@/lib/validation/commerce";
import { buildShippingRates, resolveShippingRate } from "@/lib/shipping";
import { getShippingSettings } from "@/services/shipping";
import { GIFT_MESSAGE_MAX_LENGTH } from "@/lib/gift-wrap";
import { CommerceError, type Address, type Checkout, type CompleteCheckoutResult, type Order } from "@/lib/commerce/types";
import { getEmailProvider, orderConfirmationEmail } from "@/lib/email";
import { getSiteSettings } from "@/services/settings";
import { rewardReferralIfPending } from "@/services/referrals";
import { initiatePayment, resolveSelectedMethod } from "@/services/payments";
import { getSiteUrl } from "@/lib/site-url";
import { getDefaultShippingRate } from "@/services/shipping";

/**
 * The discounts on a cart that are still valid right now — pure filter, no side effects.
 *
 * Exported for the unit test: the interesting cases (a code that expired since it was
 * applied, one an admin switched off) are about time and state rather than about SQL.
 */
export function filterValidDiscounts<T extends { code: string }>(
  applied: T[],
  live: { code: string; active: boolean; expiresAt?: string | Date | null }[],
  now: Date = new Date()
): T[] {
  const validCodes = new Set(
    live
      .filter((d) => d.active && (!d.expiresAt || new Date(d.expiresAt).getTime() >= now.getTime()))
      .map((d) => d.code)
  );
  return applied.filter((d) => validCodes.has(d.code));
}

async function resolveValidCartDiscounts(
  discounts: { code: string; type: "percentage" | "fixed"; value: number }[]
): Promise<{ code: string; type: "percentage" | "fixed"; value: number }[]> {
  if (discounts.length === 0) return [];
  const live = await prisma.discount.findMany({
    where: { code: { in: discounts.map((d) => d.code) } },
    select: { code: true, active: true, expiresAt: true },
  });
  return filterValidDiscounts(discounts, live);
}

async function requireCheckoutRow(checkoutId: string) {
  const row = await prisma.checkout.findUnique({ where: { id: checkoutId } });
  if (!row) throw new CommerceError("CART_NOT_FOUND", "Checkout session not found.");
  return row;
}

/**
 * Idempotent within a single checkout session — reentering /checkout for a cart
 * that already has an in-progress (non-completed) row reuses it instead of
 * orphaning a new one. But `Checkout` is one-to-MANY off `Cart` (the cart row is
 * reused indefinitely rather than replaced after an order — see the cart DELETE
 * route), because `Order.checkoutId` is a permanent unique pointer to the exact
 * session that produced it: a completed checkout can never legitimately host a
 * second order. So a shopper who buys once, adds more items to that same cart,
 * and checks out again gets a genuinely NEW row here — reusing the old
 * (completed) one would either crash `completeCheckout` on that same unique
 * constraint, or (with the idempotency guard there) silently hand back their
 * FIRST order's confirmation while never processing the new purchase.
 */
export async function createCheckout(cartId: string): Promise<Checkout> {
  const existing = await prisma.checkout.findFirst({
    where: { cartId, status: { not: "completed" } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return toCheckout(existing);

  const row = await prisma.checkout.create({ data: { cartId, status: "open" } });
  return toCheckout(row);
}

export async function updateEmail(checkoutId: string, email: string): Promise<Checkout> {
  await requireCheckoutRow(checkoutId);
  const row = await prisma.checkout.update({ where: { id: checkoutId }, data: { email } });
  return toCheckout(row);
}

export async function updateShippingAddress(checkoutId: string, address: Address): Promise<Checkout> {
  await requireCheckoutRow(checkoutId);
  const row = await prisma.checkout.update({ where: { id: checkoutId }, data: { shippingAddress: toJsonInput(address) } });
  return toCheckout(row);
}

export async function updateBillingAddress(checkoutId: string, address: Address): Promise<Checkout> {
  await requireCheckoutRow(checkoutId);
  const row = await prisma.checkout.update({ where: { id: checkoutId }, data: { billingAddress: toJsonInput(address) } });
  return toCheckout(row);
}

export async function setShippingRate(checkoutId: string, rateId: string): Promise<Checkout> {
  await requireCheckoutRow(checkoutId);
  // No rate at all means the store has none enabled — a misconfiguration rather than bad
  // input, so this reports the same "checkout can't proceed" shape the other gates use.
  const rate = resolveShippingRate(buildShippingRates(await getShippingSettings()), rateId);
  if (!rate) throw new CommerceError("CHECKOUT_INCOMPLETE", "No shipping rate is available.");
  const row = await prisma.checkout.update({
    where: { id: checkoutId },
    data: { shippingRate: toJsonInput(rate), status: "awaiting_payment" },
  });
  return toCheckout(row);
}

export async function setGiftWrap(checkoutId: string, giftWrap: boolean, giftMessage?: string): Promise<Checkout> {
  await requireCheckoutRow(checkoutId);
  const row = await prisma.checkout.update({
    where: { id: checkoutId },
    data: { giftWrap, giftMessage: giftWrap ? (giftMessage?.slice(0, GIFT_MESSAGE_MAX_LENGTH) ?? null) : null },
  });
  return toCheckout(row);
}

/**
 * Records which payment method the shopper picked.
 *
 * Stored, not trusted: nothing here decides that the method is usable. It's
 * validated against the live configuration a second time in `completeCheckout`,
 * because between this call and the order being placed an admin can disable the
 * method, the cart total can cross a minimum/maximum, or the shopper can change
 * country. Only the check that happens at the moment money is involved counts.
 */
export async function setPaymentMethod(checkoutId: string, paymentMethodId: string): Promise<Checkout> {
  await requireCheckoutRow(checkoutId);
  const row = await prisma.checkout.update({ where: { id: checkoutId }, data: { paymentMethodId } });
  return toCheckout(row);
}

/**
 * The authoritative totals for a checkout, including the selected payment
 * method's surcharge. Shared by the payment-methods API (to quote a total) and by
 * `completeCheckout` (to charge one) so the number shown and the number charged
 * are produced by the same code path.
 */
export async function resolveCheckoutAmounts(checkoutId: string, paymentFeeOverride?: number) {
  const checkoutRow = await requireCheckoutRow(checkoutId);
  const cartRow = await prisma.cart.findUnique({ where: { id: checkoutRow.cartId }, include: cartInclude });
  if (!cartRow) throw new CommerceError("CART_NOT_FOUND", "Cart not found.");
  const cart = toCart(cartRow, await getDefaultShippingRate());
  // A checkout that never reached the delivery step has no stored rate; fall back to the
  // store's default rather than to a constant this module used to hardcode.
  const shippingRate = checkoutRow.shippingRate
    ? shippingRateSchema.parse(checkoutRow.shippingRate)
    : resolveShippingRate(buildShippingRates(await getShippingSettings()));

  const resolved = resolveCartAmounts({
    lineItems: cart.lineItems.map((item) => ({ unitPriceAmount: item.unitPrice.amount, quantity: item.quantity, savedForLater: false })),
    // Same live re-validation as completeCheckout. This function is what QUOTES the total
    // at the payment step, and the two must not disagree: quoting a lapsed discount and
    // then charging without it is how a shopper is shown one price and billed another.
    discounts: await resolveValidCartDiscounts(
      cart.discounts.map((d) => ({ code: d.code, type: d.type, value: d.value }))
    ),
    giftCards: cart.giftCards.map((g) => ({ code: g.code, balanceAmount: g.balance.amount })),
    currencyCode: cart.currencyCode,
    selectedShippingRate: shippingRate,
    giftWrap: checkoutRow.giftWrap,
    paymentFee: paymentFeeOverride,
  });

  return { checkoutRow, cartRow, cart, shippingRate, ...resolved };
}

/**
 * Ignores any client-supplied cart data (the interface's `completeCheckout(checkoutId,
 * cart)` shape is preserved at the Route Handler for parity, but the handler discards
 * the body) — always re-fetches the authoritative cart server-side. In one transaction:
 * re-validates + decrements stock per line item (re-checked at purchase time, not just
 * add-to-cart time), decrements applied gift card balances, creates the Order snapshot,
 * marks the checkout completed, and clears the cart's line items/discounts/gift-cards.
 */
export async function completeCheckout(checkoutId: string): Promise<CompleteCheckoutResult> {
  const checkoutRow = await requireCheckoutRow(checkoutId);

  // Idempotency guard: a double-click, a slow network retry, or a re-submitted request
  // racing the button's disabled state can all send two /complete calls for the same
  // checkout. The first legitimately creates the Order; without this check, the second
  // would crash on the `checkoutId` unique constraint (order.create below) and surface
  // a raw 500 to a shopper whose order actually went through fine. Returning the
  // already-created order instead makes retries safe rather than merely "caught."
  if (checkoutRow.status === "completed") {
    const existingOrder = await prisma.order.findUnique({ where: { checkoutId } });
    // Payment initiation is idempotent on its own key too, so re-running it for an
    // already-completed checkout returns the SAME payment and, for a redirect
    // provider, the same redirect URL — which is exactly what a shopper who
    // refreshed mid-payment needs.
    if (existingOrder) return resumePaymentForOrder(toOrder(existingOrder), checkoutRow.paymentMethodId);
  }

  if (!checkoutRow.shippingAddress || !checkoutRow.email) {
    throw new CommerceError("CHECKOUT_INCOMPLETE", "Checkout is missing required address/email details.");
  }
  // A payment method is as required as the address. Without this an order could be
  // created with no Payment row at all — stock decremented, gift cards debited, status
  // "confirmed" — and the confirmation page's `isSettled || !payment` branch rendered it
  // with the green success tick, so nothing anywhere said the shop had not been paid.
  // The method is still re-validated against live configuration below; this only
  // establishes that one was chosen.
  if (!checkoutRow.paymentMethodId) {
    throw new CommerceError("CHECKOUT_INCOMPLETE", "Choose a payment method before placing your order.");
  }
  const email = checkoutRow.email;
  const shippingAddress = storedAddressSchema.parse(checkoutRow.shippingAddress);
  const billingAddress = checkoutRow.billingAddress ? storedAddressSchema.parse(checkoutRow.billingAddress) : shippingAddress;
  const shippingRate = checkoutRow.shippingRate
    ? shippingRateSchema.parse(checkoutRow.shippingRate)
    : resolveShippingRate(buildShippingRates(await getShippingSettings()));

  const cartRow = await prisma.cart.findUnique({ where: { id: checkoutRow.cartId }, include: cartInclude });
  if (!cartRow) throw new CommerceError("CART_NOT_FOUND", "Cart not found.");
  const cart = toCart(cartRow, await getDefaultShippingRate());

  const lineItemsForTotals = cart.lineItems.map((item) => ({
    unitPriceAmount: item.unitPrice.amount,
    quantity: item.quantity,
    savedForLater: false,
  }));
  /**
   * Discounts are re-validated against the live rows here, not trusted from the cart.
   *
   * `applyDiscountCode` checks `active` and `expiresAt` at the moment the shopper types the
   * code — and then the cart row keeps the rule indefinitely. A cart is long-lived: the code
   * can expire, or an admin can deactivate it, between the shopper applying it and placing
   * the order, and the discount would still come off the total. Exactly the reasoning that
   * already re-validates the payment method a few lines down, applied to the other thing on
   * a cart whose validity is time-bounded.
   *
   * An invalid one is dropped rather than failing the order: the shopper still wants the
   * shoes, and refusing a purchase outright over a lapsed promo code is worse for both
   * sides than charging the correct price.
   */
  const discountRules = await resolveValidCartDiscounts(cart.discounts);
  const giftCardRules = cart.giftCards.map((g) => ({ code: g.code, balanceAmount: g.balance.amount }));

  // Two passes, and the order matters. A percentage payment fee is a percentage OF
  // the order total, so the total has to exist before the fee can be computed — and
  // then folded back in. Computing it in one pass would either apply the percentage
  // to the wrong base or require the browser to supply a number, which §22 forbids.
  const withoutFee = resolveCartAmounts({
    lineItems: lineItemsForTotals,
    discounts: discountRules,
    giftCards: giftCardRules,
    currencyCode: cart.currencyCode,
    selectedShippingRate: shippingRate,
    giftWrap: checkoutRow.giftWrap,
  });

  // Re-validated here rather than trusted from the checkout row: an admin may have
  // disabled the method, or the cart may have changed, since it was chosen.
  const selectedMethod = checkoutRow.paymentMethodId
    ? await resolveSelectedMethod(checkoutRow.paymentMethodId, {
        amount: withoutFee.totals.total.amount,
        currencyCode: cart.currencyCode,
        countryCode: shippingAddress.countryCode,
        shippingRateId: shippingRate?.id,
      })
    : null;

  const { totals, giftCards } = resolveCartAmounts({
    lineItems: lineItemsForTotals,
    discounts: discountRules,
    giftCards: giftCardRules,
    currencyCode: cart.currencyCode,
    selectedShippingRate: shippingRate,
    giftWrap: checkoutRow.giftWrap,
    paymentFee: selectedMethod?.fee ?? 0,
  });

  let orderRow;
  try {
    orderRow = await prisma.$transaction(async (tx) => {
      // Was 2 sequential finds per line item (2N+ round trips for an N-item cart, inside
      // one lock-holding transaction). Both lookups are independent of each other and of
      // every other item, so batch each into a single query up front instead — an OR of
      // exact (productId, size) pairs for sizes (a plain `IN` on each column separately
      // would cross-match sizes from other products in the same cart) and a plain `IN` on
      // product id, since inventoryPolicy isn't keyed by size.
      const productIds = [...new Set(cart.lineItems.map((item) => item.productId))];
      const [sizeRows, productRows] = await Promise.all([
        tx.productSize.findMany({
          where: { OR: cart.lineItems.map((item) => ({ productId: item.productId, name: item.size })) },
        }),
        tx.product.findMany({ where: { id: { in: productIds } } }),
      ]);
      const sizeByKey = new Map(sizeRows.map((row) => [`${row.productId}:${row.name}`, row]));
      const productById = new Map(productRows.map((row) => [row.id, row]));

      /**
       * Demand is aggregated PER STOCK ROW before anything is written, because a cart can
       * legitimately contain the same size twice — two colourways of one product share a
       * single ProductSize row. Checking each line independently let both pass against the
       * same single unit.
       */
      const demandBySize = new Map<string, { sizeId: string; needed: number; canOversell: boolean; label: string }>();
      for (const item of cart.lineItems) {
        const sizeRow = sizeByKey.get(`${item.productId}:${item.size}`);
        const canOversell = productById.get(item.productId)?.inventoryPolicy === "continue";
        const label = `${item.name} (${item.size})`;
        // No stock row at all is zero available — buyable only where overselling is allowed.
        if (!sizeRow) {
          if (!canOversell) throw new CommerceError("OUT_OF_STOCK", `${label} is no longer available in that quantity.`);
          continue;
        }
        const existing = demandBySize.get(sizeRow.id);
        if (existing) existing.needed += item.quantity;
        else demandBySize.set(sizeRow.id, { sizeId: sizeRow.id, needed: item.quantity, canOversell, label });
      }

      /**
       * The availability check IS the write.
       *
       * This used to read the quantity, compare it in JS, and then decrement — three
       * statements with a gap in the middle. At Postgres' default Read Committed isolation
       * two shoppers buying the last unit both read 1, both passed, and the second
       * decrement applied to the already-decremented row: one unit, two orders, and stock
       * left at -1. The clamp that looked like it prevented that was computed from the same
       * stale read, so it prevented nothing.
       *
       * A conditional UPDATE closes the gap without table locks or a raised isolation
       * level: Postgres serialises writers on the row, re-evaluates `quantity >= needed`
       * against the committed value, and reports how many rows it actually touched. Zero
       * means somebody else got there first.
       */
      for (const { sizeId, needed, canOversell, label } of demandBySize.values()) {
        if (canOversell) {
          // Overselling is allowed to exceed the shelf but not to go below zero — the same
          // floor the previous min() clamp produced, and the one services/restock.ts relies
          // on when it declines to credit these lines back.
          await tx.$executeRaw`UPDATE "product_sizes" SET "quantity" = GREATEST("quantity" - ${needed}, 0) WHERE "id" = ${sizeId}`;
          continue;
        }
        const { count } = await tx.productSize.updateMany({
          where: { id: sizeId, quantity: { gte: needed } },
          data: { quantity: { decrement: needed } },
        });
        if (count === 0) {
          throw new CommerceError("OUT_OF_STOCK", `${label} is no longer available in that quantity.`);
        }
      }

      /**
       * The same conditional-update shape as the stock decrement above, for the same
       * reason — and this one moves money.
       *
       * A bare `decrement` with no guard let two checkouts redeeming the same code both
       * pass, taking the balance negative: the shop paying out more than the card was
       * ever worth, with nothing anywhere reporting it. It is an easier race to hit than
       * the stock one, because a gift card is a single code that anyone holding it can
       * spend — it needs two people with the same card, not two people racing for the
       * last unit. It does not even need to be concurrent: `applyGiftCard` snapshots the
       * balance onto the cart, so a card spent on another order between adding it and
       * checking out would have been redeemed twice on a stale number.
       *
       * `active` is re-checked here even though `applyGiftCard` checks it, because an
       * admin can deactivate a card between the cart and the order — the same reason the
       * payment method is re-validated rather than trusted from the checkout row.
       *
       * No aggregation pass, unlike stock: `CartGiftCard` is unique on `(cartId, code)`,
       * so one code cannot appear twice in a single cart.
       */
      for (const applied of giftCards) {
        const { count } = await tx.giftCard.updateMany({
          where: {
            code: applied.code,
            active: true,
            balanceAmount: { gte: applied.amountApplied.amount },
          },
          data: { balanceAmount: { decrement: applied.amountApplied.amount } },
        });
        if (count === 0) {
          throw new CommerceError(
            "INVALID_GIFT_CARD",
            `Gift card ${applied.code} can no longer be used — it may have been spent or deactivated.`
          );
        }
      }

      const created = await tx.order.create({
        data: {
          checkoutId,
          customerId: cartRow.customerId,
          customerEmail: email,
          lineItems: toJsonInput(cart.lineItems),
          totals: toJsonInput(totals),
          shippingAddress: toJsonInput(shippingAddress),
          billingAddress: toJsonInput(billingAddress),
          shippingRate: toJsonInput(shippingRate),
          giftWrap: checkoutRow.giftWrap,
          giftMessage: checkoutRow.giftMessage,
        },
      });

      await Promise.all([
        tx.checkout.update({ where: { id: checkoutId }, data: { status: "completed" } }),
        tx.cartLineItem.deleteMany({ where: { cartId: cartRow.id } }),
        tx.cartDiscount.deleteMany({ where: { cartId: cartRow.id } }),
        tx.cartGiftCard.deleteMany({ where: { cartId: cartRow.id } }),
      ]);

      return created;
    });
  } catch (error) {
    // Narrows the sequential-retry guard above to also cover a genuine race (two
    // /complete requests that both passed the status check before either committed):
    // the loser hits this same checkoutId unique constraint — recover by returning
    // the winner's order instead of surfacing a raw 500 for an order that did succeed.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existingOrder = await prisma.order.findUnique({ where: { checkoutId } });
      if (existingOrder) return resumePaymentForOrder(toOrder(existingOrder), checkoutRow.paymentMethodId);
    }
    throw error;
  }

  const order = toOrder(orderRow);

  // The payment is started AFTER the order exists, because a payment must reference
  // an order id — and the order's totals are what it charges. If the provider
  // refuses (misconfigured, API down), the order still exists with a `failed`
  // payment attached and the shopper can retry from the confirmation page, which is
  // recoverable. Losing the order instead would strand the stock decrement and the
  // gift-card debit that already committed in the transaction above.
  const paymentOutcome = await startPaymentForOrder(order, checkoutRow.paymentMethodId);

  // Sent now only when nothing further is expected of the customer. For a
  // redirect-based method the shopper hasn't paid yet, so "thanks for your order"
  // would be premature and, worse, indistinguishable from a real confirmation —
  // that email goes out from markOrderConfirmationSent() once the payment settles.
  const shouldEmailNow =
    !paymentOutcome.customerAction || paymentOutcome.customerAction.type !== "redirect";
  if (shouldEmailNow) {
    await sendOrderConfirmationEmail(order, paymentOutcome.customerAction?.instructions ?? null);
  }

  // Best-effort, same reasoning as the confirmation email — a signed-in
  // customer's first completed order may be the one a referral was waiting on.
  if (cartRow.customerId) {
    try {
      await rewardReferralIfPending(cartRow.customerId);
    } catch (referralError) {
      console.error("Failed to process referral reward", referralError);
    }
  }

  return { order, ...paymentOutcome };
}

/**
 * Starts (or recovers) the payment for an order and normalises the result into the
 * provider-agnostic shape the checkout consumes. A checkout with no method selected
 * still produces an order — the shop simply has no payment record for it, which is
 * the honest representation of "nobody chose how to pay".
 */
async function startPaymentForOrder(
  order: Order,
  paymentMethodId: string | null
): Promise<Omit<CompleteCheckoutResult, "order">> {
  if (!paymentMethodId) return { payment: null, customerAction: null };

  const siteUrl = getSiteUrl().replace(/\/$/, "");
  try {
    const { payment, customerAction } = await initiatePayment({
      order: {
        orderId: order.id,
        customerEmail: order.customerEmail,
        customerId: null,
        lineItems: order.lineItems,
        totals: order.totals,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
      },
      methodId: paymentMethodId,
      returnUrls: {
        // The success URL is where the browser lands, NOT proof of anything — the
        // confirmation page re-verifies server-side before showing a paid state.
        success: `${siteUrl}/checkout/confirmation?order=${order.id}&verify=1`,
        cancel: `${siteUrl}/checkout/confirmation?order=${order.id}&cancelled=1`,
      },
    });
    return {
      payment: { id: payment.id, status: payment.status, methodId: payment.methodId, providerId: payment.providerId },
      customerAction,
    };
  } catch (error) {
    // Already recorded against the payment row by services/payments.ts. Swallowed
    // here so the shopper sees their real order with a clear "payment didn't
    // start" state rather than a 500 that implies the whole purchase failed.
    console.error("Failed to start payment for order", order.id, error);
    return { payment: null, customerAction: null };
  }
}

/** The retry/refresh path — `initiatePayment` is idempotent, so this returns the existing payment. */
async function resumePaymentForOrder(order: Order, paymentMethodId: string | null): Promise<CompleteCheckoutResult> {
  const outcome = await startPaymentForOrder(order, paymentMethodId);
  return { order, ...outcome };
}

/**
 * Sends the order-confirmation email at most once per order, whichever code path
 * gets there first (checkout, the return-path verification, or a webhook). The
 * timestamp is set BEFORE sending and only from a null state, so two concurrent
 * senders can't both pass the check.
 */
export async function sendOrderConfirmationEmail(
  order: Order,
  paymentInstructions: { label: string; value: string }[] | null
): Promise<void> {
  const claimed = await prisma.order.updateMany({
    where: { id: order.id, confirmationEmailSentAt: null },
    data: { confirmationEmailSentAt: new Date() },
  });
  if (claimed.count === 0) return;

  // Best-effort and awaited, not fire-and-forget: an un-awaited promise here could
  // be killed mid-flight the moment this function returns and the route handler's
  // response is sent (real risk on serverless runtimes). Wrapped in try/catch so a
  // failed send never fails an order that has already been committed.
  try {
    const settings = await getSiteSettings();
    const message = orderConfirmationEmail({
      siteName: settings.siteName,
      orderId: order.id,
      lineItems: order.lineItems,
      totals: order.totals,
      shippingAddress: order.shippingAddress,
      shippingRate: order.shippingRate,
      giftWrap: order.giftWrap,
      giftMessage: order.giftMessage,
      paymentInstructions,
    });
    await getEmailProvider().send({ to: order.customerEmail, template: "order-confirmation", ...message });
  } catch (emailError) {
    // Release the claim so a later attempt (a webhook, an admin resend) can retry
    // rather than the order being permanently marked as notified.
    await prisma.order.update({ where: { id: order.id }, data: { confirmationEmailSentAt: null } }).catch(() => {});
    console.error("Failed to send order confirmation email", emailError);
  }
}
