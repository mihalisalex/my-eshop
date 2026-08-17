import { z } from "zod";

/** Json-column shape validation for Cart/Checkout/Order — mirrors lib/commerce/types.ts exactly. */

export const moneySchema = z.object({
  amount: z.number(),
  currencyCode: z.string(),
});

export const shippingRateSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  price: moneySchema,
  estimatedDelivery: z.string(),
});

export const cartLineItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  slug: z.string(),
  name: z.string(),
  image: z.object({ src: z.string(), alt: z.string() }),
  color: z.string(),
  size: z.string(),
  unitPrice: moneySchema,
  quantity: z.number(),
  maxQuantity: z.number(),
  savedForLater: z.boolean(),
  addedAt: z.string(),
});

export const cartTotalsSchema = z.object({
  subtotal: moneySchema,
  discountTotal: moneySchema,
  giftCardTotal: moneySchema,
  shippingTotal: moneySchema,
  // .optional() so historical Order.totals snapshots written before gift wrapping
  // existed still parse — they genuinely had no gift-wrap charge, so defaulting to
  // zero (in the same currency as the rest of the snapshot) is the correct value,
  // not a placeholder.
  giftWrapTotal: moneySchema.optional(),
  // Optional for exactly the same reason, and it is the same trap: every Order
  // written before payment methods existed has no payment fee in its snapshot, and
  // a required field here would fail `toOrder` on every historical order — which
  // previously broke /admin/orders at BUILD time, not at runtime. Zero is the
  // historically correct value, not a placeholder.
  paymentFeeTotal: moneySchema.optional(),
  taxTotal: moneySchema,
  total: moneySchema,
});

export const returnItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  color: z.string(),
  size: z.string(),
  quantity: z.number().int().positive(),
});

/** Route Handler request-body shape for POST app/api/customer/returns. */
export const createReturnInputSchema = z.object({
  orderId: z.string().min(1),
  items: z.array(returnItemSchema).min(1),
  reason: z.string().min(1).max(1000),
});

/** Route Handler request-body shapes for app/api/cart/*. */
export const addLineItemInputSchema = z.object({
  productId: z.string().min(1),
  color: z.string().min(1),
  size: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const updateQuantityBodySchema = z.object({ quantity: z.number().int() });
export const savedForLaterBodySchema = z.object({ savedForLater: z.boolean() });
export const codeBodySchema = z.object({ code: z.string().min(1) });
