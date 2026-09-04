"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { capabilityDenied, requireCapability } from "@/lib/admin-session";
import { recordAdminAction } from "@/services/audit-log";
import { productFormSchema, type ProductFormValues } from "@/lib/validation/product";
import { writeProductRow } from "@/lib/products-import/write";
import { productIdsMatching, type AdminProductFilter } from "@/services/products";

export interface ProductActionState {
  error?: string;
}

/** Revalidating the whole tree is a blunt instrument, but correct: nothing in this phase can compute the precise set of storefront pages (PLPs, collections, related-product cross-links) affected by an arbitrary catalog edit. */
function revalidateStorefront() {
  revalidatePath("/", "layout");
}

export async function createProduct(values: ProductFormValues): Promise<ProductActionState> {
  const denied = await capabilityDenied("catalog:edit");
  if (denied) return { error: denied };
  const parsed = productFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
  if (existing) return { error: "A product with this slug already exists." };

  const { id } = await writeProductRow(data);

  revalidateStorefront();
  redirect(`/admin/products/${id}`);
}

export async function updateProduct(id: string, values: ProductFormValues): Promise<ProductActionState> {
  const denied = await capabilityDenied("catalog:edit");
  if (denied) return { error: denied };
  const parsed = productFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
  if (existing && existing.id !== id) return { error: "A product with this slug already exists." };

  /**
   * OBS-003. Read the price BEFORE the write. "A product's price is wrong and nobody knows
   * what it used to be" is the exact question this finding was opened about, and an
   * overwritten column cannot answer it — `updatedAt` says when, never what or who.
   *
   * `product.created` deliberately has no equivalent: a product that exists is its own
   * evidence, so there is nothing lost to reconstruct.
   */
  const before = await prisma.product.findUnique({
    where: { id },
    select: { priceAmount: true, salePriceAmount: true, sku: true, name: true, status: true },
  });

  await writeProductRow(data, id);

  // Decimal, so compare numerically — the Prisma value and the form value are different
  // representations of the same number and never string-equal.
  const priceChanged = before != null && Number(before.priceAmount) !== Number(data.price);
  await recordAdminAction({
    action: "product.updated",
    targetType: "product",
    targetId: id,
    summary: priceChanged
      ? `Changed the price of ${before?.sku ?? id} from ${before?.priceAmount} to ${data.price}`
      : `Edited ${before?.sku ?? id}`,
    metadata: {
      sku: before?.sku,
      ...(priceChanged ? { priceBefore: String(before?.priceAmount), priceAfter: data.price } : {}),
      ...(before && before.status !== data.status ? { statusBefore: before.status, statusAfter: data.status } : {}),
    },
  });

  revalidateStorefront();
  redirect(`/admin/products/${id}`);
}

/**
 * Hard delete. Kept for genuine mistakes (a test product, a duplicate import), but it is no
 * longer the default retirement path — `archiveProduct` is, because deleting a product that
 * appears in past orders destroys the record of what was actually sold. The FK from
 * CartLineItem/WishlistItem cascades, so this also silently empties customers' carts and
 * wishlists; archiving does neither.
 */
export async function deleteProduct(id: string): Promise<void> {
  await requireCapability("catalog:delete");
  // The cascade this comment warns about is precisely why the entry is worth having: it is
  // the one catalogue action that also reaches into customers' carts and wishlists.
  const product = await prisma.product.findUnique({
    where: { id },
    select: { sku: true, name: true, slug: true },
  });
  await prisma.product.delete({ where: { id } });
  await recordAdminAction({
    action: "product.deleted",
    targetType: "product",
    targetId: id,
    summary: `Deleted product ${product?.sku ?? id}${product?.name ? ` (${product.name})` : ""}`,
    metadata: { sku: product?.sku, name: product?.name, slug: product?.slug },
  });
  revalidateStorefront();
  redirect("/admin/products");
}

export async function archiveProduct(id: string): Promise<ProductActionState> {
  const denied = await capabilityDenied("catalog:edit");
  if (denied) return { error: denied };
  await prisma.product.update({
    where: { id },
    data: { status: "archived", archivedAt: new Date() },
  });
  revalidateStorefront();
  revalidatePath("/admin/products");
  return {};
}

export async function restoreProduct(id: string): Promise<ProductActionState> {
  const denied = await capabilityDenied("catalog:edit");
  if (denied) return { error: denied };
  // Restores to "draft", never straight to "active": a product was archived for a reason,
  // so bringing it back should be a deliberate two-step (restore, review, then publish)
  // rather than silently putting it in front of customers again.
  await prisma.product.update({
    where: { id },
    data: { status: "draft", archivedAt: null },
  });
  revalidateStorefront();
  revalidatePath("/admin/products");
  return {};
}

/**
 * Copies a product as a new draft. Slug and SKU are both unique, so they're suffixed until
 * free rather than blindly `-copy`'d — duplicating twice is a normal thing to do and
 * hitting a constraint violation on the second attempt would be a pointless dead end.
 */
export async function duplicateProduct(id: string): Promise<ProductActionState> {
  const denied = await capabilityDenied("catalog:edit");
  if (denied) return { error: denied };

  const source = await prisma.product.findUnique({
    where: { id },
    include: { colors: true, sizes: true, collections: true },
  });
  if (!source) return { error: "That product no longer exists." };

  const [slug, sku] = await Promise.all([
    nextAvailable(source.slug, async (candidate) => Boolean(await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } }))),
    nextAvailable(source.sku, async (candidate) => Boolean(await prisma.product.findUnique({ where: { sku: candidate }, select: { id: true } }))),
  ]);

  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    colors,
    sizes,
    collections,
    ...scalars
  } = source;

  const created = await prisma.product.create({
    data: {
      ...scalars,
      slug,
      sku,
      name: `${source.name} (copy)`,
      // A copy is never born live — it needs a real name/slug/price review first.
      status: "draft",
      archivedAt: null,
      images: source.images as Prisma.InputJsonValue,
      videos: source.videos === null ? Prisma.JsonNull : (source.videos as Prisma.InputJsonValue),
      seo: source.seo === null ? Prisma.JsonNull : (source.seo as Prisma.InputJsonValue),
      colors: {
        create: colors.map((c) => ({ position: c.position, name: c.name, hex: c.hex, imageSrc: c.imageSrc, imageAlt: c.imageAlt })),
      },
      sizes: {
        create: sizes.map((s) => ({ position: s.position, name: s.name, inStock: s.inStock, quantity: s.quantity, sku: s.sku ? `${s.sku}-copy` : null, barcode: s.barcode })),
      },
      collections: {
        create: collections.map((c) => ({ collectionId: c.collectionId, position: c.position })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/admin/products");
  redirect(`/admin/products/${created.id}`);
}

/** Appends `-copy`, then `-copy-2`, `-copy-3`… until `isTaken` says the value is free. */
async function nextAvailable(base: string, isTaken: (candidate: string) => Promise<boolean>): Promise<string> {
  for (let attempt = 1; attempt < 100; attempt += 1) {
    const candidate = attempt === 1 ? `${base}-copy` : `${base}-copy-${attempt}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  // Unique by construction — falls back rather than looping forever.
  return `${base}-copy-${Date.now()}`;
}

export interface BulkActionState {
  error?: string;
  updated?: number;
}

export type BulkProductAction = "publish" | "draft" | "archive" | "delete";

/**
 * What a bulk action applies to. Either an explicit list of ids the admin ticked, or "every
 * product matching the filter currently on screen".
 *
 * The second exists because the products table is now server-paged (QA-046), so ticking the
 * header checkbox can only reach the 25 rows the browser has. Shipping every matching id to
 * the client to make select-all work would reintroduce the unbounded payload this change is
 * removing — so the client sends the FILTER and the server re-derives the set at the moment
 * the action runs. That is also the safer semantic: it cannot act on a stale selection built
 * before someone else edited the catalog.
 */
export type BulkProductScope = { kind: "ids"; ids: string[] } | { kind: "all-matching"; filter: AdminProductFilter };

/** Bulk lifecycle transitions. One statement per action rather than a loop of updates. */
export async function bulkUpdateProducts(action: BulkProductAction, scope: BulkProductScope): Promise<BulkActionState> {
  // Bulk delete is checked against the stricter capability, matching the single-product
  // path — otherwise the bulk endpoint would be a way for an editor to do in one call
  // exactly what deleteProduct refuses to let them do one at a time.
  const denied = await capabilityDenied(action === "delete" ? "catalog:delete" : "catalog:edit");
  if (denied) return { error: denied };

  // Resolved server-side in both cases, so the id list an action runs against is never
  // simply whatever the browser claimed.
  const ids = scope.kind === "ids" ? scope.ids : await productIdsMatching(scope.filter);
  if (ids.length === 0) return { error: "Select at least one product." };

  let updated: number;
  if (action === "delete") {
    ({ count: updated } = await prisma.product.deleteMany({ where: { id: { in: ids } } }));
  } else if (action === "archive") {
    ({ count: updated } = await prisma.product.updateMany({
      where: { id: { in: ids } },
      // Only stamp rows actually transitioning in, so re-archiving keeps the original date.
      data: { status: "archived" },
    }));
    await prisma.product.updateMany({
      where: { id: { in: ids }, archivedAt: null },
      data: { archivedAt: new Date() },
    });
  } else {
    const status = action === "publish" ? "active" : "draft";
    ({ count: updated } = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { status, archivedAt: null },
    }));
  }

  // One entry for the batch rather than one per product: the fact worth recording is that
  // somebody deleted 40 products in a single call, and 40 separate rows would obscure that
  // rather than sharpen it.
  await recordAdminAction({
    action: "product.bulk_updated",
    targetType: "product",
    targetId: `bulk:${action}`,
    summary: `Bulk ${action} across ${updated} product${updated === 1 ? "" : "s"}`,
    metadata: { action, requested: ids.length, updated, scope: scope.kind },
  });

  revalidateStorefront();
  revalidatePath("/admin/products");
  return { updated };
}
