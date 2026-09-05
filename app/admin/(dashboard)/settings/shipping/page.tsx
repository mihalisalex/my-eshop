import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ShippingSettingsForm } from "@/components/admin/ShippingSettingsForm";
import { getShippingSettings } from "@/services/shipping";
import { saveShippingSettingsAction } from "@/app/admin/(dashboard)/settings/shipping/actions";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminShippingSettingsPage() {
  await requireCapabilityOrRedirect("admin:settings");
  const settings = await getShippingSettings();

  return (
    <div>
      <AdminPageHeader
        title="Shipping"
        description="Delivery methods, their prices and the free-shipping threshold. The Cash on Delivery fee lives with the payment methods, under Settings → Payments."
      />
      <ShippingSettingsForm initialSettings={settings} onSave={saveShippingSettingsAction} />
    </div>
  );
}
