import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock, Landmark } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { getOrderById } from "@/services/orders";
import { getPrimaryPaymentForOrder, verifyPaymentWithProvider } from "@/services/payments";
import { sendOrderConfirmationEmail } from "@/services/checkout";
import { paymentProviderRegistry } from "@/lib/payments/registry";
import { PAYMENT_STATUS_LABEL } from "@/lib/payments/status";
import { PurchaseAnalytics } from "@/components/checkout/PurchaseAnalytics";
import type { PaymentRecord } from "@/lib/payments/types";
import type { Metadata } from "next";

/**
 * Rebuilt as a Server Component.
 *
 * It used to read the order out of `sessionStorage`, which cannot survive a
 * redirect-based payment: the shopper leaves for the provider's page and comes
 * back on a fresh navigation. More importantly, an order object the browser was
 * holding could never show whether the payment actually settled.
 *
 * So the page now loads the order server-side and — this is §14 in practice —
 * **re-verifies the payment against the provider before showing a paid state**. The
 * `?verify=1` in the return URL is only a hint that a verification is worth doing;
 * it is never itself treated as evidence. A shopper who hand-types `&verify=1`
 * triggers a real provider lookup that returns whatever is true.
 *
 * The order id is the capability token, the same convention this app already uses
 * for cart and checkout ids: an unguessable cuid, scoped to one purchase.
 */
export const metadata: Metadata = {
  title: "Order Confirmation",
  robots: { index: false, follow: false },
};

interface ConfirmationPageProps {
  searchParams: Promise<{ order?: string; verify?: string; cancelled?: string }>;
}

export default async function CheckoutConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const { order: orderId, verify, cancelled } = await searchParams;

  if (!orderId) {
    return (
      <div className="container-luxe flex flex-col items-center gap-4 py-32 text-center">
        <h1 className="font-heading text-2xl">No recent order found</h1>
        <p className="text-sm text-luxe-gray-dark">This page is only available right after placing an order.</p>
        <Link
          href="/"
          className="mt-2 flex h-12 items-center justify-center bg-luxe-black px-8 text-xs font-medium tracking-[0.08em] text-luxe-white uppercase"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  const order = await getOrderById(orderId);
  if (!order) notFound();

  let payment = await getPrimaryPaymentForOrder(order.id);

  // Only for a payment that could still move. Re-polling a settled or terminal
  // payment on every page view would be a pointless API call per refresh.
  if (payment && verify === "1" && !["paid", "refunded", "cancelled", "expired"].includes(payment.status)) {
    payment = await verifyPaymentWithProvider(payment.id);
  }

  // The confirmation email is withheld at checkout for redirect-based methods
  // (the shopper hadn't paid yet). Now that we know, send it — guarded so the
  // webhook and this page can't both send one.
  if (payment?.status === "paid") {
    await sendOrderConfirmationEmail(order, null);
  }

  const method = payment ? paymentProviderRegistry.getMethod(payment.methodId) : null;
  const instructions = readInstructions(payment);
  const isSettled = payment?.status === "paid";
  const awaitingCustomer = payment?.status === "awaiting_customer_action";
  const isFailed = payment?.status === "failed" || payment?.status === "cancelled" || payment?.status === "expired";

  return (
    <div className="container-luxe max-w-2xl py-16 md:py-24">
      {isSettled ? <PurchaseAnalytics orderId={order.id} total={order.totals.total.amount} /> : null}

      <div className="flex flex-col items-center text-center">
        {isFailed ? (
          <AlertCircle className="size-12 text-destructive" strokeWidth={1} />
        ) : isSettled || !payment ? (
          <CheckCircle2 className="size-12 text-luxe-black" strokeWidth={1} />
        ) : (
          <Clock className="size-12 text-luxe-black" strokeWidth={1} />
        )}
        <h1 className="mt-4 font-heading text-3xl">
          {isFailed ? "Your payment didn't go through" : "Thank you for your order"}
        </h1>
        <p className="mt-2 text-sm text-luxe-gray-dark">
          {isFailed ? (
            <>
              Your order <span className="text-luxe-black">#{order.id.slice(-8).toUpperCase()}</span> is saved, but we
              haven&apos;t received payment. Please get in touch and we&apos;ll help you complete it.
            </>
          ) : (
            <>
              A confirmation has been sent to <span className="text-luxe-black">{order.customerEmail}</span>.
            </>
          )}
        </p>
        <p className="mt-1 text-sm text-luxe-gray-dark">Order number: {order.id}</p>
      </div>

      {payment ? (
        <div className="mt-8 border border-border p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-eyebrow">Payment</p>
            <span className="text-xs tracking-[0.05em] uppercase text-luxe-gray-dark">
              {PAYMENT_STATUS_LABEL[payment.status]}
            </span>
          </div>
          <p className="mt-2 text-sm">{method?.defaultDisplayName ?? payment.methodId}</p>

          {cancelled === "1" && awaitingCustomer ? (
            <p className="mt-3 text-sm text-luxe-gray-dark">
              It looks like you came back without finishing. Your order is held — contact us and we can send you a fresh
              payment link.
            </p>
          ) : null}

          {instructions.length > 0 ? (
            <>
              <div className="mt-4 flex items-center gap-2 text-xs tracking-[0.05em] uppercase text-luxe-gray-dark">
                <Landmark className="size-3.5" strokeWidth={1.5} />
                How to pay
              </div>
              <dl className="mt-2 divide-y divide-border border-t border-border">
                {instructions.map((line) => (
                  <div key={line.label} className="flex items-baseline justify-between gap-4 py-2">
                    <dt className="text-xs text-luxe-gray-dark">{line.label}</dt>
                    <dd className="text-right text-sm break-all">{line.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}

          {typeof payment.metadata.customerMessage === "string" ? (
            <p className="mt-3 text-sm text-luxe-gray-dark">{payment.metadata.customerMessage}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-10 divide-y divide-border border-y border-border">
        {order.lineItems.map((item) => (
          <div key={item.id} className="flex items-center gap-4 py-4">
            <div className="relative size-16 shrink-0 overflow-hidden bg-luxe-gray-light">
              <Image src={item.image.src} alt={item.image.alt} fill sizes="64px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{item.name}</p>
              <p className="text-xs text-luxe-gray-dark">
                {item.color} · {item.size} · Qty {item.quantity}
              </p>
            </div>
            <p className="shrink-0 text-sm">
              {formatMoney({ amount: item.unitPrice.amount * item.quantity, currencyCode: item.unitPrice.currencyCode })}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-luxe-gray-dark">Subtotal</span>
          <span>{formatMoney(order.totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-luxe-gray-dark">Shipping</span>
          <span>{formatMoney(order.totals.shippingTotal)}</span>
        </div>
        {order.totals.giftWrapTotal.amount > 0 ? (
          <div className="flex justify-between">
            <span className="text-luxe-gray-dark">Gift Wrapping</span>
            <span>{formatMoney(order.totals.giftWrapTotal)}</span>
          </div>
        ) : null}
        {order.totals.paymentFeeTotal.amount > 0 ? (
          <div className="flex justify-between">
            <span className="text-luxe-gray-dark">Payment Fee</span>
            <span>{formatMoney(order.totals.paymentFeeTotal)}</span>
          </div>
        ) : null}
        <div className="flex justify-between">
          <span className="text-luxe-gray-dark">Tax</span>
          <span>{formatMoney(order.totals.taxTotal)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5 text-base font-medium">
          <span>Total</span>
          <span>{formatMoney(order.totals.total)}</span>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <p className="text-eyebrow mb-1.5">Shipping to</p>
          <address className="text-sm not-italic text-luxe-gray-dark">
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            <br />
            {order.shippingAddress.address1}
            {order.shippingAddress.address2 ? <>, {order.shippingAddress.address2}</> : null}
            <br />
            {order.shippingAddress.city}
            {order.shippingAddress.region ? `, ${order.shippingAddress.region}` : ""} {order.shippingAddress.postalCode}
            <br />
            {order.shippingAddress.countryCode}
          </address>
        </div>
        <div>
          <p className="text-eyebrow mb-1.5">Delivery method</p>
          <p className="text-sm text-luxe-gray-dark">
            {order.shippingRate.label} · {order.shippingRate.estimatedDelivery}
          </p>
          {order.giftWrap ? (
            <p className="mt-3 text-sm text-luxe-gray-dark">
              Gift wrapped{order.giftMessage ? ` — "${order.giftMessage}"` : ""}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-12 border border-border p-6 text-center">
        <p className="text-eyebrow mb-1.5">What&apos;s next</p>
        <p className="text-sm text-luxe-gray-dark">
          {payment?.status === "awaiting_bank_transfer"
            ? "We'll confirm your payment as soon as the transfer reaches our account, then get your order on its way."
            : "We'll email you as soon as your order ships. You can track its status any time from your account."}
        </p>
      </div>

      <div className="mt-8 flex justify-center">
        <Link
          href="/"
          className="flex h-12 items-center justify-center bg-luxe-black px-8 text-xs font-medium tracking-[0.08em] text-luxe-white uppercase"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

/** Instructions the provider produced at initialize time, persisted on the payment's metadata. */
function readInstructions(payment: PaymentRecord | null): { label: string; value: string }[] {
  const stored = payment?.metadata.customerInstructions;
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (entry): entry is { label: string; value: string } =>
      Boolean(entry) && typeof entry === "object" && typeof (entry as { label?: unknown }).label === "string"
  );
}
