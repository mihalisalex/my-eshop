"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { capabilityDenied, requireCapability } from "@/lib/admin-session";
import { productFormSchema, type ProductFormValues } from "@/lib/validation/product";
import { writeProductRow } from "@/lib/products-import/write";

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

  await writeProductRow(data, id);

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
  await prisma.product.delete({ where: { id } });
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

/** Bulk lifecycle transitions. One statement per action rather than a loop of updates. */
export async function bulkUpdateProducts(action: BulkProductAction, ids: string[]): Promise<BulkActionState> {
  // Bulk delete is checked against the stricter capability, matching the single-product
  // path — otherwise the bulk endpoint would be a way for an editor to do in one call
  // exactly what deleteProduct refuses to let them do one at a time.
  const denied = await capabilityDenied(action === "delete" ? "catalog:delete" : "catalog:edit");
  if (denied) return { error: denied };
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

  revalidateStorefront();
  revalidatePath("/admin/products");
  return { updated };
}
