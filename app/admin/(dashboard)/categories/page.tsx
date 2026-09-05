import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CategoryTree } from "@/components/admin/CategoryTree";
import { getCategoryTree } from "@/services/categories";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminCategoriesPage() {
  const tree = await getCategoryTree();
  const total = countAll(tree);

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        description={`${total} categor${total === 1 ? "y" : "ies"}. Drag the handle to reorder siblings; open a category to move it to a different parent.`}
        actions={
          <Link
            href="/admin/categories/new"
            className="flex h-9 items-center bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase"
          >
            New Category
          </Link>
        }
      />

      <CategoryTree nodes={tree} />
    </div>
  );
}

function countAll(nodes: { children: unknown[] }[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countAll(node.children as { children: unknown[] }[]), 0);
}
