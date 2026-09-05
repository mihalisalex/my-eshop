import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { createCategory } from "@/app/admin/(dashboard)/categories/actions";
import { emptyCategoryFormValues } from "@/lib/validation/category";
import { getCategoryOptions } from "@/services/categories";
import { getSeoDefaults } from "@/services/seo";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function NewCategoryPage() {
  const [parentOptions, seo] = await Promise.all([getCategoryOptions(), getSeoDefaults()]);

  return (
    <div>
      <AdminPageHeader title="New Category" description="Add a new category." />
      <CategoryForm
        defaultValues={emptyCategoryFormValues}
        parentOptions={parentOptions}
        seoDefaults={{ siteUrl: seo.siteUrl, titleTemplate: seo.titleTemplate }}
        onSubmit={createCategory}
        submitLabel="Create Category"
      />
    </div>
  );
}
