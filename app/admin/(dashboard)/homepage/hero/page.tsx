import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { HomepageEditor } from "@/components/admin/homepage-editor/HomepageEditor";
import { getHomepageConfig } from "@/services";
import { publishHomepageSections } from "@/app/admin/(dashboard)/homepage/actions";

export default async function AdminHeroManagementPage() {
  const homepage = await getHomepageConfig();
  const hero = homepage.sections.find((s) => s.type === "hero");

  return (
    <div>
      <AdminPageHeader
        title="Hero Management"
        description="Edit the homepage hero directly. This is the same section shown in Homepage Sections."
      />
      {hero ? (
        // The FULL section list is passed (not just [hero]) so a save here publishes
        // every other section unchanged instead of wiping them — see HomepageEditor's
        // initialSections doc comment.
        <HomepageEditor initialSections={homepage.sections} focusSectionId={hero.id} onPublish={publishHomepageSections} />
      ) : (
        <p className="text-sm text-luxe-gray-dark">No hero section configured.</p>
      )}
    </div>
  );
}
