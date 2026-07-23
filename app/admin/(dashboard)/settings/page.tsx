import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SiteSettingsForm } from "@/components/admin/SiteSettingsForm";
import { getSiteSettings } from "@/services";
import { saveSiteSettingsAction } from "@/app/admin/(dashboard)/settings/actions";

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div>
      <AdminPageHeader title="Site Settings" description="Core store information and announcement bar content." />
      <SiteSettingsForm initialSettings={settings} onSave={saveSiteSettingsAction} />
    </div>
  );
}
