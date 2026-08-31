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
import {
  bulkUpdatePrices,
  bulkUpdateStock,
  updateProductInline,
  type BulkPriceMode,
} from "@/app/admin/(dashboard)/products/edit-actions";
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
  const [notice, setNotice] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<"price" | "stock" | null>(null);
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
    setOpenPanel(null);
  }

  /** The set a bulk action applies to — ids when they were ticked, the filter when "all matching". */
  function currentScope(): BulkProductScope {
    return allMatching
      ? { kind: "all-matching", filter: { search: filter.q, status: filter.status, category: filter.category } }
      : { kind: "ids", ids: [...selected] };
  }

  function runBulkPrice(target: "price" | "salePrice", mode: BulkPriceMode, value: number) {
    if (selectionCount === 0) return;
    const what = target === "price" ? "price" : "sale price";
    const summary =
      mode === "clear"
        ? `Remove the sale price from ${selectionCount} product(s)?`
        : mode === "set"
          ? `Set the ${what} of ${selectionCount} product(s) to ${value}?`
          : `Change the ${what} of ${selectionCount} product(s) by ${value > 0 ? "+" : ""}${value}${mode === "adjust-percent" ? "%" : ""}?`;
    if (!window.confirm(summary)) return;

    startTransition(async () => {
      const result = await bulkUpdatePrices({ target, mode, value }, currentScope());
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setOpenPanel(null);
      setNotice(
        result.inverted
          ? `Updated ${result.updated} product(s). ${result.inverted} now have a sale price at or above their price — worth a look.`
          : `Updated ${result.updated} product(s).`
      );
    });
  }

  function runBulkStock(mode: "set" | "adjust", value: number) {
    if (selectionCount === 0) return;
    const summary =
      mode === "set"
        ? `Set every size of ${selectionCount} product(s) to ${value} in stock?`
        : `Change every size of ${selectionCount} product(s) by ${value > 0 ? "+" : ""}${value}?`;
    if (!window.confirm(summary)) return;

    startTransition(async () => {
      const result = await bulkUpdateStock({ mode, value }, currentScope());
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setOpenPanel(null);
      setNotice(`Updated stock on ${result.updated} size(s).`);
    });
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

    startTransition(async () => {
      const result = await bulkUpdateProducts(action, currentScope());
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
      {notice ? <p className="mb-3 border border-border bg-luxe-gray-light/40 p-3 text-sm">{notice}</p> : null}

      {selectionCount > 0 ? (
        <div className="mb-3 border border-luxe-black bg-luxe-gray-light/40">
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            <span className="text-sm font-medium">
              {allMatching ? `All ${total} matching products selected` : `${selected.size} selected on this page`}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <BulkButton onClick={() => setOpenPanel(openPanel === "price" ? null : "price")} disabled={isPending}>
                Prices…
              </BulkButton>
              <BulkButton onClick={() => setOpenPanel(openPanel === "stock" ? null : "stock")} disabled={isPending}>
                Stock…
              </BulkButton>
              <BulkButton onClick={() => runBulk("publish")} disabled={isPending}>Publish</BulkButton>
              <BulkButton onClick={() => runBulk("draft")} disabled={isPending}>Move to draft</BulkButton>
              <BulkButton onClick={() => runBulk("archive")} disabled={isPending}>Archive</BulkButton>
              <BulkButton onClick={() => runBulk("delete")} disabled={isPending} destructive>Delete</BulkButton>
              <BulkButton onClick={clearSelection} disabled={isPending}>Clear</BulkButton>
            </div>
          </div>

          {openPanel === "price" ? <BulkPricePanel disabled={isPending} onApply={runBulkPrice} /> : null}
          {openPanel === "stock" ? <BulkStockPanel disabled={isPending} onApply={runBulkStock} /> : null}
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

const panelClass = "flex flex-wrap items-end gap-3 border-t border-luxe-black/20 px-4 py-3";
const fieldClass = "h-9 border border-border bg-luxe-white px-2 text-sm";
const fieldLabelClass = "mb-1 block text-[11px] font-medium tracking-[0.05em] uppercase text-luxe-gray-dark";

/**
 * Bulk repricing. Deliberately three separate decisions — which price, how to change it, by
 * how much — rather than one clever free-text box, because "-10%" and "-10" are different
 * instructions and a box that guesses between them will eventually guess wrong across the
 * whole catalogue.
 */
function BulkPricePanel({
  disabled,
  onApply,
}: {
  disabled: boolean;
  onApply: (target: "price" | "salePrice", mode: BulkPriceMode, value: number) => void;
}) {
  const [target, setTarget] = useState<"price" | "salePrice">("price");
  const [mode, setMode] = useState<BulkPriceMode>("adjust-percent");
  const [value, setValue] = useState("");

  const numeric = Number(value);
  const canApply = mode === "clear" || (value.trim() !== "" && Number.isFinite(numeric));

  return (
    <div className={panelClass}>
      <div>
        <label className={fieldLabelClass} htmlFor="bulk-price-target">Change</label>
        <select
          id="bulk-price-target"
          className={fieldClass}
          value={target}
          onChange={(e) => {
            const next = e.target.value as "price" | "salePrice";
            setTarget(next);
            // "Remove" only means anything for a sale price, so switching back to the list
            // price cannot leave an impossible combination selected.
            if (next === "price" && mode === "clear") setMode("adjust-percent");
          }}
        >
          <option value="price">Price</option>
          <option value="salePrice">Sale price</option>
        </select>
      </div>

      <div>
        <label className={fieldLabelClass} htmlFor="bulk-price-mode">How</label>
        <select id="bulk-price-mode" className={fieldClass} value={mode} onChange={(e) => setMode(e.target.value as BulkPriceMode)}>
          <option value="adjust-percent">By percent</option>
          <option value="adjust-amount">By amount</option>
          <option value="set">Set to</option>
          {target === "salePrice" ? <option value="clear">Remove</option> : null}
        </select>
      </div>

      {mode !== "clear" ? (
        <div>
          <label className={fieldLabelClass} htmlFor="bulk-price-value">
            {mode === "adjust-percent" ? "Percent (−10 = 10% off)" : mode === "adjust-amount" ? "Amount (−5 = €5 off)" : "New price"}
          </label>
          <input
            id="bulk-price-value"
            type="number"
            step={mode === "adjust-percent" ? "1" : "0.01"}
            className={`${fieldClass} w-40`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === "adjust-percent" ? "-10" : "0.00"}
          />
        </div>
      ) : null}

      <button
        type="button"
        disabled={disabled || !canApply}
        onClick={() => onApply(target, mode, mode === "clear" ? 0 : numeric)}
        className="h-9 bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase disabled:opacity-50"
      >
        Apply
      </button>
    </div>
  );
}

/** Bulk stock, applied to every size of the selected products — see bulkUpdateStock. */
function BulkStockPanel({ disabled, onApply }: { disabled: boolean; onApply: (mode: "set" | "adjust", value: number) => void }) {
  const [mode, setMode] = useState<"set" | "adjust">("set");
  const [value, setValue] = useState("");

  const numeric = Number(value);
  const canApply = value.trim() !== "" && Number.isInteger(numeric);

  return (
    <div className={panelClass}>
      <div>
        <label className={fieldLabelClass} htmlFor="bulk-stock-mode">Stock</label>
        <select id="bulk-stock-mode" className={fieldClass} value={mode} onChange={(e) => setMode(e.target.value as "set" | "adjust")}>
          <option value="set">Set every size to</option>
          <option value="adjust">Change every size by</option>
        </select>
      </div>

      <div>
        <label className={fieldLabelClass} htmlFor="bulk-stock-value">{mode === "set" ? "Quantity" : "Change (−2 = two fewer)"}</label>
        <input
          id="bulk-stock-value"
          type="number"
          step="1"
          className={`${fieldClass} w-40`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={mode === "set" ? "5" : "-2"}
        />
      </div>

      <button
        type="button"
        disabled={disabled || !canApply}
        onClick={() => onApply(mode, numeric)}
        className="h-9 bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase disabled:opacity-50"
      >
        Apply
      </button>

      <p className="w-full text-xs text-luxe-gray-dark">
        Applies to every size of the selected products. For one size at a time, use Inventory.
      </p>
    </div>
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
        <InlinePriceCell product={product} />
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
      <td className="p-3">
        <InlineStatusCell product={product} />
      </td>
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

/**
 * Price and sale price, edited where they are read.
 *
 * Changing a price used to mean opening the product form, finding one field among forty,
 * and saving the whole record back. This writes the two columns and nothing else.
 *
 * The displayed figure is the EFFECTIVE price — what the product actually sells for — with
 * the list price struck through beside it, matching what the column already showed. Both
 * are editable because they only make sense as a pair: a sale price is only meaningful
 * relative to the price it is below, and the server refuses the inverted combination.
 */
function InlinePriceCell({ product }: { product: Product }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(String(product.price.amount));
  const [salePrice, setSalePrice] = useState(product.salePrice ? String(product.salePrice.amount) : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function open() {
    // Re-seeded from the row each time rather than kept in sync, so an edit always starts
    // from what is currently stored instead of from a stale draft left over from last time.
    setPrice(String(product.price.amount));
    setSalePrice(product.salePrice ? String(product.salePrice.amount) : "");
    setError(null);
    setEditing(true);
  }

  function save() {
    const nextPrice = Number(price);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      setError("Price must be greater than 0.");
      return;
    }
    const trimmedSale = salePrice.trim();
    const nextSale = trimmedSale === "" ? null : Number(trimmedSale);
    if (nextSale !== null && (!Number.isFinite(nextSale) || nextSale <= 0)) {
      setError("Sale price must be greater than 0.");
      return;
    }

    startTransition(async () => {
      const result = await updateProductInline(product.id, { price: nextPrice, salePrice: nextSale });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={open}
        title="Edit price"
        className="text-left underline decoration-dotted underline-offset-4 hover:decoration-solid"
      >
        {formatMoney(getEffectivePrice(product))}
        {product.salePrice ? (
          <span className="ml-1.5 text-xs text-luxe-gray-dark line-through">{formatMoney(product.price)}</span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-center gap-1"
        // Enter saves and Escape cancels from anywhere in the pair, which is what makes this
        // usable down a column of rows without reaching for the mouse.
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
      >
        <input
          type="number"
          step="0.01"
          autoFocus
          aria-label="Price"
          className="h-8 w-20 border border-border px-1.5 text-sm"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <input
          type="number"
          step="0.01"
          aria-label="Sale price (blank for none)"
          placeholder="Sale"
          className="h-8 w-20 border border-border px-1.5 text-sm"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
        />
        <button type="button" onClick={save} disabled={isPending} className="text-xs font-medium uppercase disabled:opacity-50">
          {isPending ? "…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={isPending} className="text-xs text-luxe-gray-dark uppercase">
          Esc
        </button>
      </div>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

/** Publication state, changed from the list. Saves on selection — there is nothing to confirm. */
function InlineStatusCell({ product }: { product: Product }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label={`Status for ${product.name}`}
        disabled={isPending}
        value={product.status}
        onChange={(e) => {
          const status = e.target.value as ProductStatus;
          startTransition(async () => {
            const result = await updateProductInline(product.id, { status });
            setError(result?.error ?? null);
          });
        }}
        className={`h-8 border border-transparent bg-transparent px-1 text-sm capitalize hover:border-border disabled:opacity-50 ${STATUS_STYLES[product.status]}`}
      >
        <option value="active">Active</option>
        <option value="draft">Draft</option>
        <option value="archived">Archived</option>
      </select>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
