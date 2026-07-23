import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { HomepageEditor } from "@/components/admin/homepage-editor/HomepageEditor";
import { getHomepageConfig } from "@/services";
import { publishHomepageSections } from "@/app/admin/(dashboard)/homepage/actions";

export default async function AdminHomepagePage() {
  const homepage = await getHomepageConfig();

  return (
    <div>
      <AdminPageHeader
        title="Homepage Sections"
        description="Enable, disable, reorder, and edit every section of the homepage."
      />
      <HomepageEditor initialSections={homepage.sections} onPublish={publishHomepageSections} />
    </div>
  );
}
