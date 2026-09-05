import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { DEFAULT_PAGE_SIZE, parsePage, parseSearch } from "@/lib/pagination";
import { listProductsForAdmin, PRODUCT_SORT_KEYS, type ProductSortKey } from "@/services/products";
import { getAllCategories } from "@/services/categories";
import type { ProductStatus } from "@/types";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

const STATUSES: ProductStatus[] = ["active", "draft", "archived"];

interface AdminProductsPageProps {
  searchParams: Promise<{ q?: string; status?: string; category?: string; sort?: string; page?: string }>;
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const params = await searchParams;

  // Every filter is read defensively — these arrive from a URL a human can type, and an
  // unrecognised value has to mean "no filter" rather than "match nothing".
  const search = parseSearch(params.q);
  const status = STATUSES.includes(params.status as ProductStatus) ? (params.status as ProductStatus) : undefined;
  const category = parseSearch(params.category) || undefined;
  const sort = PRODUCT_SORT_KEYS.includes(params.sort as ProductSortKey) ? (params.sort as ProductSortKey) : "newest";

  const [paged, categories] = await Promise.all([
    // No publication filter: admin sees every lifecycle state — this is the one surface that must.
    listProductsForAdmin({ search, status, category, sort, page: parsePage(params.page), pageSize: DEFAULT_PAGE_SIZE }),
    getAllCategories(),
  ]);

  const isFiltered = Boolean(search || status || category);

  return (
    <div>
      <AdminPageHeader
        title="Products"
        description={
          isFiltered
            ? `${paged.total} matching ${paged.total === 1 ? "product" : "products"}.`
            : `${paged.total} products.`
        }
        actions={
          <Link
            href="/admin/products/new"
            className="flex h-9 items-center bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase"
          >
            New Product
          </Link>
        }
      />

      <ProductsTable
        products={paged.rows}
        total={paged.total}
        page={paged.page}
        pageCount={paged.pageCount}
        filter={{ q: search, status, category, sort }}
        categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
      />
    </div>
  );
}
