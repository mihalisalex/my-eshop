import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConnectionStatusPill } from "@/components/admin/PaymentStatusPill";
import { ProviderConfigForm } from "@/components/admin/payments/ProviderConfigForm";
import { MethodSettingsForm } from "@/components/admin/payments/MethodSettingsForm";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";
import { paymentProviderRegistry } from "@/lib/payments/registry";
import { getAllMethodSettings, toAdminConfigView } from "@/lib/payments/config";
import { getProviderStates } from "@/services/payments";
import { buildShippingRates } from "@/lib/shipping";
import { getShippingSettings } from "@/services/shipping";
import { getSiteUrl } from "@/lib/site-url";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

/**
 * One settings page per provider (§18) — but written ONCE.
 *
 * `[provider]` is a dynamic segment resolved against the registry, and every field
 * on the page comes from the provider's own declaration. That's why §10 holds:
 * registering a future provider produces its settings page for free, with no route,
 * no component and no migration.
 */
interface ProviderSettingsPageProps {
  params: Promise<{ provider: string }>;
}

export async function generateMetadata({ params }: ProviderSettingsPageProps) {
  const { provider: providerId } = await params;
  const provider = paymentProviderRegistry.get(providerId);
  return { title: provider ? `${provider.name} — Payment Settings` : "Payment Settings" };
}

export default async function ProviderSettingsPage({ params }: ProviderSettingsPageProps) {
  await requireCapabilityOrRedirect("payments:configure");
  const { provider: providerId } = await params;

  const provider = paymentProviderRegistry.get(providerId);
  if (!provider) notFound();

  // `states` rather than `view.configured` for the badge: a delegating provider
  // (Apple Pay) is only really connected when its processor is too.
  const [view, allSettings, states] = await Promise.all([
    toAdminConfigView(providerId),
    getAllMethodSettings(),
    getProviderStates(),
  ]);
  const isConnected = states.get(providerId)?.configured ?? view.configured;
  const settingsById = new Map(allSettings.map((settings) => [settings.methodId, settings]));
  const shippingRates = buildShippingRates(await getShippingSettings()).map((rate) => ({ id: rate.id, label: rate.label }));
  const webhookUrl = `${getSiteUrl().replace(/\/$/, "")}/api/payments/webhooks/${provider.id}`;

  return (
    <div>
      <Link
        href="/admin/settings/payments"
        className="mb-4 inline-flex items-center gap-1.5 text-xs tracking-[0.05em] text-luxe-gray-dark uppercase transition-colors hover:text-luxe-black"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.5} />
        All payment settings
      </Link>

      <AdminPageHeader
        title={provider.name}
        description={provider.description}
        actions={
          <ConnectionStatusPill
            status={provider.integrationPending ? "not_implemented" : isConnected ? "connected" : "not_configured"}
          />
        }
      />

      {provider.integrationPending ? (
        <div className="mb-6 flex gap-2 border border-amber-600/40 bg-amber-500/10 p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
          <div>
            <p className="font-medium">This integration isn&apos;t connected yet.</p>
            <p className="mt-1 text-luxe-gray-dark">{provider.pendingReason}</p>
            <p className="mt-2 text-luxe-gray-dark">
              You can store credentials here now, but the method will not appear at checkout and no payment can be
              created until the integration is completed. Nothing about the checkout, the order model or this dashboard
              needs to change when it is.
            </p>
          </div>
        </div>
      ) : null}

      {view.lastTestedAt ? (
        <p className="mb-4 text-xs text-luxe-gray-dark">
          Last connection test: {new Date(view.lastTestedAt).toLocaleString()} — {view.lastTestStatus}
          {view.lastTestMessage ? ` · ${view.lastTestMessage}` : ""}
        </p>
      ) : null}

      <ProviderConfigForm view={view} />

      {provider.webhookSupported ? (
        <div className="mt-6 border border-border bg-luxe-white p-5">
          <h3 className="text-sm font-medium tracking-[0.05em] uppercase">Webhook endpoint</h3>
          <p className="mt-1 text-sm text-luxe-gray-dark">
            Register this URL with {provider.name}. Every delivery is signature-verified, deduplicated and logged before
            it can change a payment&apos;s status.
          </p>
          <code className="mt-3 block border border-border bg-luxe-gray-light px-3 py-2 text-xs break-all">
            {webhookUrl}
          </code>
        </div>
      ) : null}

      <section className="mt-8 space-y-6">
        <h3 className="text-sm font-medium tracking-[0.05em] uppercase">
          Payment method{provider.methods.length === 1 ? "" : "s"}
        </h3>
        {provider.methods.map((definition) => {
          const settings = settingsById.get(definition.id);
          if (!settings) return null;
          return (
            <MethodSettingsForm
              key={definition.id}
              definition={definition}
              settings={settings}
              shippingRates={shippingRates}
            />
          );
        })}
      </section>
    </div>
  );
}
