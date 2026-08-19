"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { getEffectivePrice, getProductMargin } from "@/lib/product";
import { ListFilterBar } from "@/components/admin/ListFilterBar";
import { Pagination } from "@/components/admin/Pagination";
import { bulkUpdateProducts, type BulkProductAction, type BulkProductScope } from "@/app/admin/(dashboard)/products/actions";
import { duplicateProduct } from "@/app/admin/(dashboard)/products/actions";
import type { Product, ProductStatus } from "@/types";

const STATUS_STYLES: Record<ProductStatus, string> = {
  active: "text-green-700",
  draft: "text-amber-600",
  archived: "text-luxe-gray-dark",
};

export interface ProductTableFilter {
  q: string;
  status?: ProductStatus;
  category?: string;
  sort: string;
}

interface ProductsTableProps {
  /** One page of products, already filtered, sorted and paged by the server. */
  products: Product[];
  total: number;
  page: number;
  pageCount: number;
  filter: ProductTableFilter;
  categories: { slug: string; name: string }[];
}

const PAGE_SIZE = 25;

/**
 * QA-046: this table used to receive the entire catalog and filter, sort and page it in the
 * browser. Everything now happens in SQL and arrives one page at a time.
 *
 * Filtering is a plain GET form (ListFilterBar), so the filters live in the URL and a
 * filtered view is a shareable, refreshable link — the same property the storefront listing
 * pages already had and the admin did not.
 *
 * The part that kept this finding open was select-all. With only 25 rows in the browser,
 * a header checkbox can honestly mean "these 25" and nothing more, so:
 *
 *   - the header checkbox selects the rows on THIS page, and says so;
 *   - when they are all selected and more match, a banner offers "select all N matching";
 *   - choosing that stores a FILTER, not a list of ids — the server re-derives the set when
 *     the action runs. Shipping every matching id to the client to make select-all work
 *     would reintroduce the unbounded payload this change exists to remove, and would also
 *     act on a selection built before anyone else's edits.
 *
 * Selection is per-page rather than accumulated across pages: an invisible selection that
 * survives navigation is how someone deletes 300 products believing they selected three.
 */
export function ProductsTable({ products, total, page, pageCount, filter, categories }: ProductsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pageIds = products.map((p) => p.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const selectionCount = allMatching ? total : selected.size;
  const canOfferAllMatching = allOnPageSelected && total > products.length;

  function toggleAll() {
    setAllMatching(false);
    setSelected(() => (allOnPageSelected ? new Set() : new Set(pageIds)));
  }

  function toggleOne(id: string) {
    // Any individual change ends an "all matching" selection — it no longer describes the set.
    setAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setAllMatching(false);
    setSelected(new Set());
  }

  function runBulk(action: BulkProductAction) {
    if (selectionCount === 0) return;

    const label = { publish: "publish", draft: "move to draft", archive: "archive", delete: "permanently delete" }[action];
    // The confirmation states the real number, which for an "all matching" selection is the
    // server's total rather than anything visible on screen.
    const confirmation =
      action === "delete"
        ? `Permanently delete ${selectionCount} product(s)? This cannot be undone — archive instead if you just want them off the storefront.`
        : `${label[0].toUpperCase()}${label.slice(1)} ${selectionCount} product(s)?`;
    if (!window.confirm(confirmation)) return;

    const scope: BulkProductScope = allMatching
      ? { kind: "all-matching", filter: { search: filter.q, status: filter.status, category: filter.category } }
      : { kind: "ids", ids: [...selected] };

    startTransition(async () => {
      const result = await bulkUpdateProducts(action, scope);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(null);
        clearSelection();
      }
    });
  }

  const isFiltered = Boolean(filter.q || filter.status || filter.category);
  const pageParams = { q: filter.q, status: filter.status, category: filter.category, sort: filter.sort };

  return (
    <div>
      <ListFilterBar
        action="/admin/products"
        searchValue={filter.q}
        searchPlaceholder="Search name, SKU or brand"
        selects={[
          {
            name: "status",
            label: "All statuses",
            value: filter.status ?? "",
            options: [
              { value: "active", label: "Active" },
              { value: "draft", label: "Draft" },
              { value: "archived", label: "Archived" },
            ],
          },
          {
            name: "category",
            label: "All categories",
            value: filter.category ?? "",
            options: categories.map((c) => ({ value: c.slug, label: c.name })),
          },
          {
            name: "sort",
            label: "Newest",
            value: filter.sort === "newest" ? "" : filter.sort,
            options: [
              { value: "name", label: "Name A–Z" },
              { value: "price-asc", label: "Price low–high" },
              { value: "price-desc", label: "Price high–low" },
              { value: "margin", label: "Margin high–low" },
            ],
          },
        ]}
      />

      {error ? <p className="mb-3 border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}

      {selectionCount > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 border border-luxe-black bg-luxe-gray-light/40 px-4 py-2.5">
          <span className="text-sm font-medium">
            {allMatching ? `All ${total} matching products selected` : `${selected.size} selected on this page`}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <BulkButton onClick={() => runBulk("publish")} disabled={isPending}>Publish</BulkButton>
            <BulkButton onClick={() => runBulk("draft")} disabled={isPending}>Move to draft</BulkButton>
            <BulkButton onClick={() => runBulk("archive")} disabled={isPending}>Archive</BulkButton>
            <BulkButton onClick={() => runBulk("delete")} disabled={isPending} destructive>Delete</BulkButton>
            <BulkButton onClick={clearSelection} disabled={isPending}>Clear</BulkButton>
          </div>
        </div>
      ) : null}

      {canOfferAllMatching && !allMatching ? (
        <p className="mb-3 border border-border bg-luxe-gray-light/30 px-4 py-2.5 text-sm">
          All {products.length} products on this page are selected.{" "}
          <button type="button" onClick={() => setAllMatching(true)} className="font-medium underline underline-offset-2">
            Select all {total} matching products
          </button>
        </p>
      ) : null}

      <div className="overflow-x-auto border border-border bg-luxe-white">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  aria-label={allOnPageSelected ? "Deselect the products on this page" : "Select the products on this page"}
                />
              </th>
              <th className="p-3 text-left font-medium">Product</th>
              <th className="p-3 text-left font-medium">Category</th>
              <th className="p-3 text-left font-medium">Price</th>
              <th className="p-3 text-left font-medium">Margin</th>
              <th className="p-3 text-left font-medium">Status</th>
              <th className="w-24 p-3" />
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-luxe-gray-dark">
                  {isFiltered ? "No products match these filters." : "No products yet."}
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  selected={allMatching || selected.has(product.id)}
                  onToggle={() => toggleOne(product.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/admin/products"
        params={pageParams}
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={PAGE_SIZE}
        label="products"
      />
    </div>
  );
}

function BulkButton({
  onClick,
  disabled,
  destructive,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-8 border px-3 text-xs font-medium tracking-[0.05em] uppercase disabled:opacity-50 ${
        destructive ? "border-destructive text-destructive" : "border-luxe-black"
      }`}
    >
      {children}
    </button>
  );
}

function ProductRow({ product, selected, onToggle }: { product: Product; selected: boolean; onToggle: () => void }) {
  const [isPending, startTransition] = useTransition();
  const margin = getProductMargin(product);

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="p-3">
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${product.name}`} />
      </td>
      <td className="p-3">
        <Link href={`/admin/products/${product.id}`} className="flex items-center gap-3 hover:underline">
          <div className="relative size-12 shrink-0 overflow-hidden bg-luxe-gray-light">
            {product.images[0] ? (
              <Image src={product.images[0].src} alt={product.images[0].alt} fill className="object-cover" />
            ) : null}
          </div>
          <div>
            <p>{product.name}</p>
            <p className="text-xs text-luxe-gray-dark">
              {product.sku}
              {product.brand ? ` · ${product.brand}` : ""}
            </p>
          </div>
        </Link>
      </td>
      <td className="p-3 capitalize">{product.category}</td>
      {/* The effective price — what the product actually sells for. This column showed
          `product.price` (the pre-discount figure), and 172 of 175 products carry a sale
          price, so the owner was reading EUR 79 for something the storefront was selling
          at EUR 59 on almost every row. The list price is kept alongside, struck through,
          so nothing is lost. */}
      <td className="p-3">
        {formatMoney(getEffectivePrice(product))}
        {product.salePrice ? (
          <span className="ml-1.5 text-xs text-luxe-gray-dark line-through">{formatMoney(product.price)}</span>
        ) : null}
      </td>
      <td className="p-3">
        {margin ? (
          <span className={margin.marginPercent < 0 ? "text-destructive" : undefined}>
            {margin.marginPercent.toFixed(0)}%
            <span className="ml-1 text-xs text-luxe-gray-dark">{formatMoney({ amount: margin.profit, currencyCode: product.price.currencyCode })}</span>
          </span>
        ) : (
          <span className="text-xs text-luxe-gray-dark">No cost set</span>
        )}
      </td>
      <td className={`p-3 capitalize ${STATUS_STYLES[product.status]}`}>{product.status}</td>
      <td className="p-3 text-right">
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(async () => { await duplicateProduct(product.id); })}
          className="text-xs font-medium tracking-[0.05em] uppercase disabled:opacity-50"
        >
          {isPending ? "…" : "Duplicate"}
        </button>
      </td>
    </tr>
  );
}
