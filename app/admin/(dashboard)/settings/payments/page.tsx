import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { ConnectionStatusPill } from "@/components/admin/PaymentStatusPill";
import { PaymentMethodIcon } from "@/components/checkout/PaymentMethodIcon";
import { MethodEnabledToggle } from "@/components/admin/payments/MethodEnabledToggle";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";
import { paymentProviderRegistry } from "@/lib/payments/registry";
import { getAllMethodSettings } from "@/lib/payments/config";
import { describePaymentFee } from "@/lib/payments/fees";
import { isSecretStorageConfigured } from "@/lib/payments/crypto";
import { getPaymentDashboardStats, getProviderStates } from "@/services/payments";
import { getSiteUrl } from "@/lib/site-url";
import { formatMoney } from "@/lib/format";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

/**
 * The central payment control panel (§16/§17).
 *
 * Everything on this page is derived from the registry rather than hardcoded — the
 * method table, the provider cards, even the links to each settings page. Register
 * a new provider and it appears here, with its own configuration screen, without a
 * line of UI being written.
 */
export const metadata = { title: "Payment Settings" };

export default async function PaymentSettingsPage() {
  await requireCapabilityOrRedirect("payments:configure");

  const providers = paymentProviderRegistry.list();
  // Deliberately the SAME resolution the checkout uses, rather than calling
  // `provider.isConfigured()` here — that shortcut reported Apple Pay as connected
  // with no Stripe credentials configured, because a delegating provider is
  // configured in its own right and simply has nothing to settle through.
  const [stats, methodSettings, states] = await Promise.all([
    getPaymentDashboardStats(),
    getAllMethodSettings(),
    getProviderStates(),
  ]);

  const providerStates = providers.map((provider) => {
    const state = states.get(provider.id);
    return {
      provider,
      enabled: state?.enabled ?? false,
      configured: state?.configured ?? false,
      environment: state?.config.environment ?? "sandbox",
    };
  });
  const stateByProvider = new Map(providerStates.map((state) => [state.provider.id, state]));
  const settingsById = new Map(methodSettings.map((settings) => [settings.methodId, settings]));
  const methods = paymentProviderRegistry
    .listMethods()
    .map((definition) => ({ definition, settings: settingsById.get(definition.id)! }))
    .sort((a, b) => a.settings.sortOrder - b.settings.sortOrder);

  const siteUrl = getSiteUrl().replace(/\/$/, "");

  return (
    <div>
      <AdminPageHeader
        title="Payments"
        description="Every payment method and provider in one place. Enable, configure, test and control availability."
        actions={
          <Link
            href="/admin/payments"
            className="flex h-9 items-center gap-1.5 border border-border px-3 text-xs font-medium tracking-[0.05em] uppercase transition-colors hover:border-luxe-black"
          >
            View transactions
            <ArrowRight className="size-3.5" strokeWidth={1.5} />
          </Link>
        }
      />

      {!isSecretStorageConfigured() ? (
        <div className="mb-6 border border-amber-600/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Credential storage isn&apos;t configured.</p>
          <p className="mt-1 text-luxe-gray-dark">
            <code className="text-luxe-black">PAYMENTS_CONFIG_SECRET</code> is not set, so provider secrets can&apos;t be
            encrypted and saving them will fail. Generate one with{" "}
            <code className="text-luxe-black">openssl rand -base64 32</code> and add it to your environment. Cash on
            Delivery and Bank Transfer are unaffected — they store no secrets.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard id="methods" label="Payment methods" value={String(stats.enabledMethods)} />
        <StatCard id="providers" label="Active providers" value={String(stats.activeProviders)} />
        <StatCard
          id="paid-today"
          label="Paid today"
          value={formatMoney({ amount: stats.paidToday.amount, currencyCode: stats.paidToday.currencyCode })}
        />
        <StatCard id="pending" label="Pending payments" value={String(stats.pending)} />
        <StatCard id="failed" label="Failed payments" value={String(stats.failed)} />
        <StatCard id="awaiting" label="Awaiting transfers" value={String(stats.awaitingBankTransfer)} />
      </div>

      <section className="mt-8">
        <h3 className="mb-3 text-sm font-medium tracking-[0.05em] uppercase">Payment methods</h3>
        <div className="overflow-x-auto border border-border bg-luxe-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs tracking-[0.05em] text-luxe-gray-dark uppercase">
                <th className="p-3 font-medium">Payment method</th>
                <th className="p-3 font-medium">Provider</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Mode</th>
                <th className="p-3 font-medium">Fee</th>
                <th className="p-3 font-medium text-right">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {methods.map(({ definition, settings }) => {
                const state = stateByProvider.get(definition.providerId);
                const fee = describePaymentFee(settings, "EUR");
                return (
                  <tr key={definition.id}>
                    <td className="p-3">
                      <Link
                        href={`/admin/settings/payments/${definition.providerId}`}
                        className="flex items-center gap-2.5 hover:underline"
                      >
                        <PaymentMethodIcon icon={definition.icon} className="size-4 text-luxe-gray-dark" />
                        {settings.displayName ?? definition.defaultDisplayName}
                      </Link>
                    </td>
                    <td className="p-3 text-luxe-gray-dark">{state?.provider.name ?? definition.providerId}</td>
                    <td className="p-3">
                      <ConnectionStatusPill
                        status={
                          state?.provider.integrationPending
                            ? "not_implemented"
                            : state?.configured
                              ? "connected"
                              : "not_configured"
                        }
                      />
                    </td>
                    <td className="p-3 text-luxe-gray-dark">
                      {state?.provider.supportsEnvironments
                        ? state.environment === "production"
                          ? "Live"
                          : "Sandbox"
                        : "—"}
                    </td>
                    <td className="p-3 text-luxe-gray-dark">{fee ?? "—"}</td>
                    <td className="p-3 text-right">
                      <MethodEnabledToggle
                        methodId={definition.id}
                        enabled={settings.enabled}
                        // A method whose provider isn't configured can be toggled on
                        // here, but availability still refuses it at checkout. Showing
                        // that plainly beats silently reverting the switch.
                        hint={state?.configured ? undefined : "Provider not configured — won't appear at checkout yet"}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h3 className="mb-3 text-sm font-medium tracking-[0.05em] uppercase">Providers</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {providerStates.map(({ provider, enabled, configured, environment }) => (
            <Link
              key={provider.id}
              href={`/admin/settings/payments/${provider.id}`}
              className="group border border-border bg-luxe-white p-5 transition-colors hover:border-luxe-black"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{provider.name}</p>
                  <p className="mt-1 text-sm text-luxe-gray-dark">{provider.description}</p>
                </div>
                <ConnectionStatusPill
                  status={provider.integrationPending ? "not_implemented" : configured ? "connected" : "not_configured"}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-luxe-gray-dark">
                <span>{enabled ? "Enabled" : "Disabled"}</span>
                {provider.supportsEnvironments ? (
                  <span>{environment === "production" ? "Production" : "Sandbox"}</span>
                ) : null}
                <span>
                  {provider.methods.length} method{provider.methods.length === 1 ? "" : "s"}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-luxe-black opacity-0 transition-opacity group-hover:opacity-100">
                  Configure <ArrowRight className="size-3.5" strokeWidth={1.5} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8 border border-border bg-luxe-white p-5">
        <h3 className="text-sm font-medium tracking-[0.05em] uppercase">Webhook endpoints</h3>
        <p className="mt-1 text-sm text-luxe-gray-dark">
          Register these with each provider so payment confirmations reach the shop. A browser redirect is never treated
          as proof of payment — only a verified webhook or a server-side lookup is.
        </p>
        <ul className="mt-4 space-y-2">
          {providers
            .filter((provider) => provider.webhookSupported)
            .map((provider) => (
              <li key={provider.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-32 shrink-0 text-luxe-gray-dark">{provider.name}</span>
                <code className="border border-border bg-luxe-gray-light px-2 py-1 text-xs break-all">
                  {siteUrl}/api/payments/webhooks/{provider.id}
                </code>
              </li>
            ))}
        </ul>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-luxe-gray-dark">
          <ExternalLink className="size-3.5" strokeWidth={1.5} />
          Developer documentation lives in <code className="text-luxe-black">PAYMENTS.md</code> at the project root.
        </p>
      </section>
    </div>
  );
}
