"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { getCommerceProvider } from "@/lib/commerce";

export default function AccountPreferencesPage() {
  const { customer, refreshCustomer } = useAuth();
  const { toast } = useToast();

  if (!customer) return null;

  const toggleMarketing = async (checked: boolean) => {
    const commerce = getCommerceProvider();
    await commerce.customer.updateProfile(customer.id, { acceptsMarketing: checked });
    await refreshCustomer();
    toast({ title: checked ? "Subscribed to marketing emails" : "Unsubscribed from marketing emails" });
  };

  return (
    <div>
      <h1 className="font-heading text-3xl">Preferences</h1>

      <div className="mt-8 max-w-md space-y-6">
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={customer.acceptsMarketing}
            onChange={(event) => toggleMarketing(event.target.checked)}
            className="size-4 border-border accent-luxe-black"
          />
          Email me about new arrivals, sales, and editorial content
        </label>

        <p className="text-xs text-luxe-gray-dark">
          Language and currency preferences aren&apos;t configurable in this demo — the storefront is single-locale for now.
        </p>
      </div>
    </div>
  );
}
