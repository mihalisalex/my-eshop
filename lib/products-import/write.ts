import "server-only";
import { prisma } from "@/lib/prisma";
import { notifyBackInStockIfNeeded } from "@/lib/products-import/back-in-stock";
import { findOrCreateCategoryBySlug } from "@/services/categories";
import type { ProductFormValues } from "@/lib/validation/product";

/**
 * `categoryId` is resolved once, outside `toProductWriteData`, and threaded in — the
 * single-product admin form only ever submits a slug from a real `<select>` (so this
 * always just finds), while CSV import rows may reference a category that doesn't exist
 * yet (so this creates it, same auto-mapping precedent as the WooCommerce import
 * documented in NOTES.md). Either way there's exactly one resolution path.
 */
/**
 * Stamped only on the actual transition into "archived", never on a save of an
 * already-archived product — otherwise every subsequent edit would reset the archive date
 * and destroy the record of when the product was really retired. Cleared on the way out.
 * `undefined` is Prisma's "leave this column alone", which is exactly the no-op we want.
 */
function resolveArchivedAt(
  nextStatus: ProductFormValues["status"],
  previousStatus?: string
): Date | null | undefined {
  if (nextStatus !== "archived") return null;
  return previousStatus === "archived" ? undefined : new Date();
}

function toProductWriteData(data: ProductFormValues, categoryId: string, previousStatus?: string) {
  return {
    slug: data.slug,
    name: data.name,
    description: data.description,
    priceAmount: data.price,
    compareAtPriceAmount: data.compareAtPrice ?? null,
    salePriceAmount: data.salePrice ?? null,
    costPriceAmount: data.costPrice ?? null,
    currencyCode: data.currencyCode,
    images: data.images,
    videos: data.videos ?? undefined,
    categoryId,
    tags: data.tags,
    gender: data.gender,
    season: data.season ?? null,
    materials: data.materials,
    careInstructions: data.careInstructions,
    relatedProductIds: data.relatedProductIds,
    isNew: data.isNew,
    isSale: data.isSale,
    isPreorder: data.isPreorder,
    isBackorder: data.isBackorder,
    fulfillmentNote: data.fulfillmentNote ?? null,
    sku: data.sku,
    barcode: data.barcode ?? null,
    inventoryPolicy: data.inventoryPolicy,
    shippingWeightGrams: data.shippingWeightGrams ?? null,
    availableForSale: data.availableForSale,
    status: data.status,
    archivedAt: resolveArchivedAt(data.status, previousStatus),
    brand: data.brand ?? null,
    vendor: data.vendor ?? null,
    seo: data.seo ?? undefined,
  };
}

/**
 * The one write path for a validated product row — nested colors/sizes/collections are
 * always fully replaced (delete-then-recreate on update) rather than diffed, since
 * there's no stable external identity for a color/size row to diff against. Shared by
 * the single-product admin form (app/admin/(dashboard)/products/actions.ts) and the CSV
 * bulk-import tool's commit route, so there's exactly one place this logic can drift.
 */
export async function writeProductRow(data: ProductFormValues, existingId?: string): Promise<{ id: string }> {
  const { id: categoryId } = await findOrCreateCategoryBySlug(data.category);

  const nestedWrites = {
    colors: {
      create: data.colors.map((color, position) => ({
        position,
        name: color.name,
        hex: color.hex,
        imageSrc: color.imageSrc,
        imageAlt: color.imageAlt,
      })),
    },
    sizes: {
      create: data.sizes.map((size, position) => ({
        position,
        name: size.name,
        inStock: size.inStock,
        quantity: size.quantity,
        sku: size.sku,
        barcode: size.barcode,
      })),
    },
    collections: {
      create: data.collectionIds.map((collectionId, position) => ({ collectionId, position })),
    },
  };

  if (existingId) {
    // Read before the transaction — needed to diff old vs. new per-size purchasability
    // for back-in-stock notifications (the delete-then-recreate below discards it), and
    // to tell a real archive transition from a save of an already-archived product.
    const oldState = await prisma.product.findUnique({
      where: { id: existingId },
      select: { inventoryPolicy: true, status: true, sizes: { select: { name: true, quantity: true } } },
    });

    await prisma.$transaction([
      prisma.productColor.deleteMany({ where: { productId: existingId } }),
      prisma.productSize.deleteMany({ where: { productId: existingId } }),
      prisma.productCollection.deleteMany({ where: { productId: existingId } }),
      prisma.product.update({
        where: { id: existingId },
        data: { ...toProductWriteData(data, categoryId, oldState?.status), ...nestedWrites },
      }),
    ]);

    if (oldState) {
      try {
        await notifyBackInStockIfNeeded(existingId, oldState, data);
      } catch (error) {
        console.error("Failed to process back-in-stock notifications", error);
      }
    }

    return { id: existingId };
  }

  const product = await prisma.product.create({
    data: { ...toProductWriteData(data, categoryId), ...nestedWrites },
  });
  return { id: product.id };
}
