"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { getEffectivePrice, getProductMargin } from "@/lib/product";
import { bulkUpdateProducts, duplicateProduct, type BulkProductAction } from "@/app/admin/(dashboard)/products/actions";
import type { Product, ProductStatus } from "@/types";

type StatusFilter = ProductStatus | "all";
type SortKey = "newest" | "name" | "price-asc" | "price-desc" | "margin";

const STATUS_STYLES: Record<ProductStatus, string> = {
  active: "text-green-700",
  draft: "text-amber-600",
  archived: "text-luxe-gray-dark",
};

interface ProductsTableProps {
  products: Product[];
  categories: { slug: string; name: string }[];
}

/**
 * Filtering/sorting/searching runs client-side over the full catalog the server already
 * sent. That's the right trade at this catalog size (a few hundred) and keeps every
 * interaction instant with no round trip. It is explicitly NOT the right shape at tens of
 * thousands of products — at that point this needs server-side pagination with the filters
 * pushed into the query, which is why the filter state is kept flat and serialisable here.
 */
export function ProductsTable({ products, categories }: ProductsTableProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (status !== "all" && product.status !== status) return false;
      if (category !== "all" && product.category !== category) return false;
      if (!needle) return true;
      // Searching SKU and brand as well as name is the difference between "usable" and
      // "technically has a search box" — merchandisers look products up by SKU constantly.
      return (
        product.name.toLowerCase().includes(needle) ||
        product.sku.toLowerCase().includes(needle) ||
        (product.brand?.toLowerCase().includes(needle) ?? false)
      );
    });

    const sorted = [...filtered];
    switch (sort) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      // Sorts on the effective price too, so the order matches the column being read.
      case "price-asc":
        sorted.sort((a, b) => getEffectivePrice(a).amount - getEffectivePrice(b).amount);
        break;
      case "price-desc":
        sorted.sort((a, b) => getEffectivePrice(b).amount - getEffectivePrice(a).amount);
        break;
      case "margin":
        // Products with no cost set sort last rather than pretending to be 0% margin.
        sorted.sort((a, b) => (getProductMargin(b)?.marginPercent ?? -Infinity) - (getProductMargin(a)?.marginPercent ?? -Infinity));
        break;
      default:
        break;
    }
    return sorted;
  }, [products, query, status, category, sort]);

  const visibleIds = visible.map((p) => p.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulk(action: BulkProductAction) {
    const ids = [...selected];
    if (ids.length === 0) return;
    const label = { publish: "publish", draft: "move to draft", archive: "archive", delete: "permanently delete" }[action];
    if (action === "delete" && !window.confirm(`Permanently delete ${ids.length} product(s)? This cannot be undone — archive instead if you just want them off the storefront.`)) return;
    if (action !== "delete" && !window.confirm(`${label[0].toUpperCase()}${label.slice(1)} ${ids.length} product(s)?`)) return;

    startTransition(async () => {
      const result = await bulkUpdateProducts(action, ids);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(null);
        setSelected(new Set());
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, SKU or brand…"
          aria-label="Search products"
          className="h-9 min-w-56 flex-1 border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          className="h-9 border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className="h-9 border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort products"
          className="h-9 border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black"
        >
          <option value="newest">Newest</option>
          <option value="name">Name A–Z</option>
          <option value="price-asc">Price low–high</option>
          <option value="price-desc">Price high–low</option>
          <option value="margin">Margin high–low</option>
        </select>
      </div>

      {error ? <p className="mb-3 border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}

      {selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 border border-luxe-black bg-luxe-gray-light/40 px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <BulkButton onClick={() => runBulk("publish")} disabled={isPending}>Publish</BulkButton>
            <BulkButton onClick={() => runBulk("draft")} disabled={isPending}>Move to draft</BulkButton>
            <BulkButton onClick={() => runBulk("archive")} disabled={isPending}>Archive</BulkButton>
            <BulkButton onClick={() => runBulk("delete")} disabled={isPending} destructive>Delete</BulkButton>
            <BulkButton onClick={() => setSelected(new Set())} disabled={isPending}>Clear</BulkButton>
          </div>
        </div>
      ) : null}

      <p className="mb-2 text-xs text-luxe-gray-dark">
        {visible.length} of {products.length} products
      </p>

      <div className="overflow-x-auto border border-border bg-luxe-white">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  aria-label={allVisibleSelected ? "Deselect all visible products" : "Select all visible products"}
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
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-luxe-gray-dark">
                  No products match these filters.
                </td>
              </tr>
            ) : (
              visible.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  selected={selected.has(product.id)}
                  onToggle={() => toggleOne(product.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
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
