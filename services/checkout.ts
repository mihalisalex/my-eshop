import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { cartInclude, toCart, toCheckout, toJsonInput, toOrder } from "@/lib/commerce/postgres/mappers";
import { resolveCartAmounts } from "@/lib/commerce/postgres/cart-totals";
import { addressSchema } from "@/lib/validations/checkout";
import { shippingRateSchema } from "@/lib/validation/commerce";
import { resolveShippingRate, STANDARD_SHIPPING_RATE } from "@/lib/shipping";
import { GIFT_MESSAGE_MAX_LENGTH } from "@/lib/gift-wrap";
import { CommerceError, type Address, type Checkout, type Order } from "@/lib/commerce/types";
import { getEmailProvider, orderConfirmationEmail } from "@/lib/email";
import { getSiteSettings } from "@/services/settings";
import { rewardReferralIfPending } from "@/services/referrals";

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
  const rate = resolveShippingRate(rateId);
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
 * Ignores any client-supplied cart data (the interface's `completeCheckout(checkoutId,
 * cart)` shape is preserved at the Route Handler for parity, but the handler discards
 * the body) — always re-fetches the authoritative cart server-side. In one transaction:
 * re-validates + decrements stock per line item (re-checked at purchase time, not just
 * add-to-cart time), decrements applied gift card balances, creates the Order snapshot,
 * marks the checkout completed, and clears the cart's line items/discounts/gift-cards.
 */
export async function completeCheckout(checkoutId: string): Promise<Order> {
  const checkoutRow = await requireCheckoutRow(checkoutId);

  // Idempotency guard: a double-click, a slow network retry, or a re-submitted request
  // racing the button's disabled state can all send two /complete calls for the same
  // checkout. The first legitimately creates the Order; without this check, the second
  // would crash on the `checkoutId` unique constraint (order.create below) and surface
  // a raw 500 to a shopper whose order actually went through fine. Returning the
  // already-created order instead makes retries safe rather than merely "caught."
  if (checkoutRow.status === "completed") {
    const existingOrder = await prisma.order.findUnique({ where: { checkoutId } });
    if (existingOrder) return toOrder(existingOrder);
  }

  if (!checkoutRow.shippingAddress || !checkoutRow.email) {
    throw new CommerceError("CHECKOUT_INCOMPLETE", "Checkout is missing required address/email details.");
  }
  const email = checkoutRow.email;
  const shippingAddress = addressSchema.parse(checkoutRow.shippingAddress);
  const billingAddress = checkoutRow.billingAddress ? addressSchema.parse(checkoutRow.billingAddress) : shippingAddress;
  const shippingRate = checkoutRow.shippingRate ? shippingRateSchema.parse(checkoutRow.shippingRate) : STANDARD_SHIPPING_RATE;

  const cartRow = await prisma.cart.findUnique({ where: { id: checkoutRow.cartId }, include: cartInclude });
  if (!cartRow) throw new CommerceError("CART_NOT_FOUND", "Cart not found.");
  const cart = toCart(cartRow);

  // cart.totals reflects the generic standard/free shipping estimate, which ignores
  // whichever specific rate (e.g. Express) the shopper actually selected during
  // checkout — recompute with that rate's real price before charging anything.
  // Gift-card amounts are recalculated too, since how much of the total they cover
  // depends on this same corrected total.
  const { totals, giftCards } = resolveCartAmounts({
    lineItems: cart.lineItems.map((item) => ({ unitPriceAmount: item.unitPrice.amount, quantity: item.quantity, savedForLater: false })),
    discounts: cart.discounts.map((d) => ({ code: d.code, type: d.type, value: d.value })),
    giftCards: cart.giftCards.map((g) => ({ code: g.code, balanceAmount: g.balance.amount })),
    currencyCode: cart.currencyCode,
    selectedShippingRate: shippingRate,
    giftWrap: checkoutRow.giftWrap,
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

      const decrements: { sizeId: string; amount: number }[] = [];
      for (const item of cart.lineItems) {
        const sizeRow = sizeByKey.get(`${item.productId}:${item.size}`);
        const product = productById.get(item.productId);
        const availableQuantity = sizeRow?.quantity ?? 0;
        const canOversell = product?.inventoryPolicy === "continue";
        if (availableQuantity < item.quantity && !canOversell) {
          throw new CommerceError("OUT_OF_STOCK", `${item.name} (${item.size}) is no longer available in that quantity.`);
        }
        if (sizeRow) {
          decrements.push({ sizeId: sizeRow.id, amount: Math.min(item.quantity, sizeRow.quantity) });
        }
      }

      // Validation above has to finish (and can throw) before any write starts — these
      // writes hit distinct rows, so issuing them together is safe once we know every
      // item passed.
      await Promise.all([
        ...decrements.map(({ sizeId, amount }) =>
          tx.productSize.update({ where: { id: sizeId }, data: { quantity: { decrement: amount } } })
        ),
        ...giftCards.map((applied) =>
          tx.giftCard.updateMany({
            where: { code: applied.code },
            data: { balanceAmount: { decrement: applied.amountApplied.amount } },
          })
        ),
      ]);

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
      if (existingOrder) return toOrder(existingOrder);
    }
    throw error;
  }

  const order = toOrder(orderRow);

  // Best-effort and awaited, not fire-and-forget: an un-awaited promise here could
  // be killed mid-flight the moment this function returns and the route handler's
  // response is sent (real risk on serverless runtimes). Wrapped in try/catch so a
  // failed send never fails an order that has already been charged and committed.
  // Only reached on a fresh order — the two idempotent-return paths above skip
  // this, so a retry doesn't re-send the confirmation the first attempt already sent.
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
    });
    await getEmailProvider().send({ to: order.customerEmail, template: "order-confirmation", ...message });
  } catch (emailError) {
    console.error("Failed to send order confirmation email", emailError);
  }

  // Best-effort, same reasoning as the confirmation email above — a signed-in
  // customer's first completed order may be the one a referral was waiting on.
  if (cartRow.customerId) {
    try {
      await rewardReferralIfPending(cartRow.customerId);
    } catch (referralError) {
      console.error("Failed to process referral reward", referralError);
    }
  }

  return order;
}
