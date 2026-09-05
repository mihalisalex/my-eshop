import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PaymentStatusPill } from "@/components/admin/PaymentStatusPill";
import { PaymentActions } from "@/components/admin/payments/PaymentActions";
import { PaymentTimeline } from "@/components/admin/payments/PaymentTimeline";
import { currentRoleHasCapability, requireCapabilityOrRedirect } from "@/lib/admin-session";
import { getPaymentById, getPaymentTimeline, getPaymentWebhooks } from "@/services/payments";
import { getOrderById } from "@/services/orders";
import { paymentProviderRegistry } from "@/lib/payments/registry";
import { formatMoney } from "@/lib/format";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

/** Full payment detail (§24/§26) — details, order, timeline, webhooks, refunds, metadata. */
export const metadata = { title: "Payment" };

interface PaymentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminPaymentDetailPage({ params }: PaymentDetailPageProps) {
  await requireCapabilityOrRedirect("payments:view");
  const { id } = await params;

  const payment = await getPaymentById(id);
  if (!payment) notFound();

  const [order, timeline, webhooks, canManage, canRefund] = await Promise.all([
    getOrderById(payment.orderId),
    getPaymentTimeline(payment.id),
    getPaymentWebhooks(payment.id),
    currentRoleHasCapability("payments:manage"),
    currentRoleHasCapability("payments:refund"),
  ]);

  const definition = paymentProviderRegistry.getMethod(payment.methodId);
  const provider = paymentProviderRegistry.get(payment.providerId);
  const remainingRefundable = Math.max(payment.amount.amount - payment.refundedAmount.amount, 0);

  return (
    <div>
      <Link
        href="/admin/payments"
        className="mb-4 inline-flex items-center gap-1.5 text-xs tracking-[0.05em] text-luxe-gray-dark uppercase transition-colors hover:text-luxe-black"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.5} />
        All payments
      </Link>

      <AdminPageHeader
        title={`Payment #${payment.id.slice(-8).toUpperCase()}`}
        description={`${formatMoney(payment.amount)} via ${definition?.name ?? payment.methodId}`}
        actions={<PaymentStatusPill status={payment.status} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PaymentActions
            paymentId={payment.id}
            status={payment.status}
            currencyCode={payment.amount.currencyCode}
            remainingRefundable={remainingRefundable}
            supportsManualConfirmation={definition?.requiresManualConfirmation ?? false}
            supportsRefunds={definition?.supportsRefunds ?? false}
            supportsPartialRefunds={definition?.supportsPartialRefunds ?? false}
            supportsProviderLookup={Boolean(provider?.supportsConnectionTest) && !provider?.integrationPending}
            canManage={canManage}
            canRefund={canRefund}
          />

          <section className="border border-border bg-luxe-white">
            <h3 className="border-b border-border p-4 text-sm font-medium tracking-[0.05em] uppercase">Timeline</h3>
            <PaymentTimeline entries={timeline} />
          </section>

          <section className="border border-border bg-luxe-white">
            <h3 className="border-b border-border p-4 text-sm font-medium tracking-[0.05em] uppercase">
              Webhook events ({webhooks.length})
            </h3>
            {webhooks.length === 0 ? (
              <p className="p-4 text-sm text-luxe-gray-dark">
                No webhooks have been received for this payment.
                {definition?.requiresWebhook
                  ? " This method relies on them — check the endpoint is registered with the provider."
                  : " This method doesn't use them."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {webhooks.map((webhook) => (
                  <li key={webhook.id} className="p-4 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{webhook.eventType}</span>
                      <span className="text-xs text-luxe-gray-dark">
                        {new Date(webhook.receivedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-luxe-gray-dark">
                      <span>{webhook.verified ? "Signature verified" : "Signature NOT verified"}</span>
                      <span>{webhook.processingStatus}</span>
                      <span className="break-all">{webhook.eventId}</span>
                    </div>
                    {webhook.errorMessage ? (
                      <p className="mt-1.5 text-xs text-destructive">{webhook.errorMessage}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="border border-border bg-luxe-white p-4">
            <h3 className="mb-3 text-xs font-medium tracking-[0.05em] text-luxe-gray-dark uppercase">Payment</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Amount" value={formatMoney(payment.amount)} />
              {payment.refundedAmount.amount > 0 ? (
                <Row label="Refunded" value={formatMoney(payment.refundedAmount)} />
              ) : null}
              <Row label="Method" value={definition?.name ?? payment.methodId} />
              <Row label="Provider" value={provider?.name ?? payment.providerId} />
              <Row label="Mode" value={payment.environment === "production" ? "Live" : "Sandbox / test"} />
              <Row label="External ID" value={payment.externalPaymentId ?? "—"} />
              <Row label="Created" value={new Date(payment.createdAt).toLocaleString()} />
              {payment.paidAt ? <Row label="Paid" value={new Date(payment.paidAt).toLocaleString()} /> : null}
              {payment.failedAt ? <Row label="Failed" value={new Date(payment.failedAt).toLocaleString()} /> : null}
              {payment.cancelledAt ? (
                <Row label="Cancelled" value={new Date(payment.cancelledAt).toLocaleString()} />
              ) : null}
              {payment.refundedAt ? (
                <Row label="Refunded at" value={new Date(payment.refundedAt).toLocaleString()} />
              ) : null}
            </dl>
            {payment.failureReason ? (
              <p className="mt-3 border-t border-border pt-3 text-sm text-destructive">{payment.failureReason}</p>
            ) : null}
          </section>

          {order ? (
            <section className="border border-border bg-luxe-white p-4">
              <h3 className="mb-3 text-xs font-medium tracking-[0.05em] text-luxe-gray-dark uppercase">Order</h3>
              <dl className="space-y-2 text-sm">
                <Row label="Order" value={`#${order.id.slice(-8).toUpperCase()}`} />
                <Row label="Customer" value={order.customerEmail} />
                {/* Deliberately shown side by side with the payment status: they are
                    separate facts and an admin needs to see both to decide anything. */}
                <Row label="Order status" value={order.status} />
                <Row label="Order total" value={formatMoney(order.totals.total)} />
                <Row label="Items" value={String(order.lineItems.length)} />
              </dl>
              <Link
                href={`/admin/orders/${order.id}`}
                className="mt-3 inline-block text-xs underline underline-offset-4"
              >
                Open order
              </Link>
            </section>
          ) : null}

          {Object.keys(payment.metadata).length > 0 ? (
            <section className="border border-border bg-luxe-white p-4">
              <h3 className="mb-3 text-xs font-medium tracking-[0.05em] text-luxe-gray-dark uppercase">Metadata</h3>
              <dl className="space-y-2 text-xs">
                {Object.entries(payment.metadata).map(([key, value]) => (
                  <div key={key} className="flex flex-wrap justify-between gap-2">
                    <dt className="text-luxe-gray-dark">{key}</dt>
                    <dd className="max-w-[60%] text-right break-all">
                      {typeof value === "string" ? value : JSON.stringify(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-luxe-gray-dark">{label}</dt>
      <dd className="max-w-[60%] text-right break-all">{value}</dd>
    </div>
  );
}
