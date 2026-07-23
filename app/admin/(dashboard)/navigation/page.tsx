import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { NavigationEditor } from "@/components/admin/NavigationEditor";
import { getNavigation } from "@/services";
import { saveNavigationAction } from "@/app/admin/(dashboard)/navigation/actions";

export default async function AdminNavigationPage() {
  const navigation = await getNavigation();

  return (
    <div>
      <AdminPageHeader
        title="Navigation Menu"
        description="Edit the primary header links. Sub-menus and footer columns follow in a later iteration of this editor."
      />
      <NavigationEditor initialNavigation={navigation} onSave={saveNavigationAction} />
    </div>
  );
}
