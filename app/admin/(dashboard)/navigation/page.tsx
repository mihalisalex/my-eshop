import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { NavigationEditor } from "@/components/admin/NavigationEditor";
import { getNavigation } from "@/services";
import { saveNavigationAction } from "@/app/admin/(dashboard)/navigation/actions";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";

export default async function AdminNavigationPage() {
  await requireCapabilityOrRedirect("content:navigation");
  const navigation = await getNavigation();

  return (
    <div>
      <AdminPageHeader
        title="Navigation Menu"
        description="Edit the primary header links and their dropdown items. Footer columns follow in a later iteration of this editor."
      />
      <NavigationEditor initialNavigation={navigation} onSave={saveNavigationAction} />
    </div>
  );
}
