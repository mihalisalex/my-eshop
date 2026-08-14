import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { createCategory } from "@/app/admin/(dashboard)/categories/actions";
import { emptyCategoryFormValues } from "@/lib/validation/category";
import { getCategoryOptions } from "@/services/categories";

export default async function NewCategoryPage() {
  const parentOptions = await getCategoryOptions();

  return (
    <div>
      <AdminPageHeader title="New Category" description="Add a new category." />
      <CategoryForm
        defaultValues={emptyCategoryFormValues}
        parentOptions={parentOptions}
        onSubmit={createCategory}
        submitLabel="Create Category"
      />
    </div>
  );
}
