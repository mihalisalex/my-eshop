import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { HomepageEditor } from "@/components/admin/homepage-editor/HomepageEditor";
import { getHomepageConfig } from "@/services";
import { publishHomepageSections } from "@/app/admin/(dashboard)/homepage/actions";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminHomepagePage() {
  await requireCapabilityOrRedirect("content:publish");
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
