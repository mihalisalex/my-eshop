import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { PaymentStatusPill } from "@/components/admin/PaymentStatusPill";
import { PaymentFilters } from "@/components/admin/payments/PaymentFilters";
import { requireCapabilityOrRedirect, currentRoleHasCapability } from "@/lib/admin-session";
import { getPaymentDashboardStats, listPaymentsForAdmin } from "@/services/payments";
import { paymentProviderRegistry } from "@/lib/payments/registry";
import { PAYMENT_STATUS_LABEL } from "@/lib/payments/status";
import { formatMoney } from "@/lib/format";
import type { PaymentStatus } from "@/lib/payments/types";

/** The full payment transaction table (§24). */
export const metadata = { title: "Payments" };

interface PaymentsPageProps {
  searchParams: Promise<{
    provider?: string;
    method?: string;
    status?: string;
    order?: string;
    customer?: string;
    from?: string;
    to?: string;
  }>;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default async function AdminPaymentsPage({ searchParams }: PaymentsPageProps) {
  await requireCapabilityOrRedirect("payments:view");
  const filters = await searchParams;

  // Filtering happens in the database rather than client-side, unlike the products
  // and media grids — a payments table is append-only and grows without bound, so
  // it is the one list in this admin that must never assume it fits in memory.
  const [payments, stats, canConfigure] = await Promise.all([
    listPaymentsForAdmin({
      provider: filters.provider || undefined,
      method: filters.method || undefined,
      status: filters.status || undefined,
      orderId: filters.order || undefined,
      customerEmail: filters.customer || undefined,
      from: parseDate(filters.from),
      // An end date with no time means "the whole of that day", not "midnight" —
      // otherwise a same-day filter returns nothing, which reads as a broken filter.
      to: (() => {
        const parsed = parseDate(filters.to);
        if (parsed) parsed.setHours(23, 59, 59, 999);
        return parsed;
      })(),
    }),
    getPaymentDashboardStats(),
    currentRoleHasCapability("payments:configure"),
  ]);

  const methodLabels = new Map(
    paymentProviderRegistry.listMethods().map((method) => [method.id, method.defaultDisplayName])
  );
  const providerLabels = new Map(paymentProviderRegistry.list().map((provider) => [provider.id, provider.name]));

  return (
    <div>
      <AdminPageHeader
        title="Payments"
        description="Every payment attempt, its provider, its current status and its full history."
        actions={
          canConfigure ? (
            <Link
              href="/admin/settings/payments"
              className="flex h-9 items-center px-3 text-xs font-medium tracking-[0.05em] uppercase border border-border transition-colors hover:border-luxe-black"
            >
              Payment settings
            </Link>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          id="paid-today"
          label="Paid today"
          value={formatMoney({ amount: stats.paidToday.amount, currencyCode: stats.paidToday.currencyCode })}
        />
        <StatCard id="pending" label="Pending" value={String(stats.pending)} />
        <StatCard id="failed" label="Failed" value={String(stats.failed)} />
        <StatCard id="awaiting" label="Awaiting transfers" value={String(stats.awaitingBankTransfer)} />
      </div>

      <div className="mt-6">
        <PaymentFilters
          providers={paymentProviderRegistry.list().map((p) => ({ id: p.id, name: p.name }))}
          methods={paymentProviderRegistry.listMethods().map((m) => ({ id: m.id, name: m.name }))}
          statuses={Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <div className="mt-4 overflow-x-auto border border-border bg-luxe-white">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs tracking-[0.05em] text-luxe-gray-dark uppercase">
              <th className="p-3 font-medium">Payment</th>
              <th className="p-3 font-medium">Order</th>
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium">Amount</th>
              <th className="p-3 font-medium">Method</th>
              <th className="p-3 font-medium">Provider</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">External ID</th>
              <th className="p-3 font-medium">Created</th>
              <th className="p-3 font-medium">Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-luxe-gray-dark">
                  No payments match these filters.
                </td>
              </tr>
            ) : null}
            {payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-luxe-gray-light/40">
                <td className="p-3">
                  <Link href={`/admin/payments/${payment.id}`} className="hover:underline">
                    #{payment.id.slice(-8).toUpperCase()}
                  </Link>
                  {payment.environment === "sandbox" ? (
                    <span className="ml-2 border border-border px-1 text-[10px] tracking-[0.05em] text-luxe-gray-dark uppercase">
                      Test
                    </span>
                  ) : null}
                </td>
                <td className="p-3">
                  <Link href={`/admin/orders/${payment.orderId}`} className="text-luxe-gray-dark hover:underline">
                    #{payment.orderId.slice(-8).toUpperCase()}
                  </Link>
                </td>
                <td className="p-3 text-luxe-gray-dark">{payment.customerEmail}</td>
                <td className="p-3">
                  {formatMoney(payment.amount)}
                  {payment.refundedAmount.amount > 0 ? (
                    <span className="block text-xs text-luxe-gray-dark">
                      −{formatMoney(payment.refundedAmount)} refunded
                    </span>
                  ) : null}
                </td>
                <td className="p-3 text-luxe-gray-dark">{methodLabels.get(payment.methodId) ?? payment.methodId}</td>
                <td className="p-3 text-luxe-gray-dark">{providerLabels.get(payment.providerId) ?? payment.providerId}</td>
                <td className="p-3">
                  <PaymentStatusPill status={payment.status as PaymentStatus} />
                </td>
                <td className="p-3 text-xs text-luxe-gray-dark">
                  {payment.externalPaymentId ? (
                    <span className="break-all">{payment.externalPaymentId}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3 text-luxe-gray-dark">{new Date(payment.createdAt).toLocaleDateString()}</td>
                <td className="p-3 text-luxe-gray-dark">
                  {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payments.length >= 500 ? (
        <p className="mt-3 text-xs text-luxe-gray-dark">
          Showing the 500 most recent payments that match. Narrow the date range to see older ones.
        </p>
      ) : null}
    </div>
  );
}
