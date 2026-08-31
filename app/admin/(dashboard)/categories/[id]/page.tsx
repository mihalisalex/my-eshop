import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { DeleteCategoryButton } from "@/components/admin/DeleteCategoryButton";
import { updateCategory } from "@/app/admin/(dashboard)/categories/actions";
import { categoryToFormValues } from "@/lib/validation/category";
import { getCategoryById, getCategoryOptions, getChildCategories } from "@/services/categories";
import { getSeoDefaults } from "@/services/seo";

interface AdminCategoryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCategoryDetailPage({ params }: AdminCategoryDetailPageProps) {
  const { id } = await params;
  const [category, parentOptions, children, seo] = await Promise.all([
    getCategoryById(id),
    getCategoryOptions(id),
    getChildCategories(id),
    getSeoDefaults(),
  ]);
  if (!category) notFound();

  const boundUpdate = updateCategory.bind(null, id);

  return (
    <div>
      <AdminPageHeader
        title={category.name}
        description={`/${category.slug} · ${category.productCount ?? 0} products${children.length ? ` · ${children.length} subcategories` : ""}`}
        actions={<DeleteCategoryButton id={id} name={category.name} />}
      />

      {children.length > 0 ? (
        <div className="mb-6 border border-border bg-luxe-white p-4">
          <p className="mb-2 text-eyebrow">Subcategories</p>
          <div className="flex flex-wrap gap-2">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/admin/categories/${child.id}`}
                className="border border-border px-3 py-1 text-xs hover:border-luxe-black"
              >
                {child.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <CategoryForm
        defaultValues={categoryToFormValues(category)}
        parentOptions={parentOptions}
        seoDefaults={{ siteUrl: seo.siteUrl, titleTemplate: seo.titleTemplate }}
        onSubmit={boundUpdate}
        submitLabel="Save Changes"
      />
    </div>
  );
}
