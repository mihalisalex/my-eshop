import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SeoSettingsForm } from "@/components/admin/SeoSettingsForm";
import { getSeoDefaults } from "@/services";
import { saveSeoDefaultsAction } from "@/app/admin/(dashboard)/seo/actions";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminSeoPage() {
  await requireCapabilityOrRedirect("admin:settings");
  const seo = await getSeoDefaults();

  return (
    <div>
      <AdminPageHeader
        title="SEO Settings"
        description="Site-wide metadata defaults. Individual pages can still override title/description."
      />
      <SeoSettingsForm initialSeo={seo} onSave={saveSeoDefaultsAction} />
    </div>
  );
}
