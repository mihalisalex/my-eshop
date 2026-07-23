import "server-only";
import { prisma } from "@/lib/prisma";
import { notifyBackInStockIfNeeded } from "@/lib/products-import/back-in-stock";
import type { ProductFormValues } from "@/lib/validation/product";

function toProductWriteData(data: ProductFormValues) {
  return {
    slug: data.slug,
    name: data.name,
    description: data.description,
    priceAmount: data.price,
    compareAtPriceAmount: data.compareAtPrice ?? null,
    salePriceAmount: data.salePrice ?? null,
    currencyCode: data.currencyCode,
    images: data.images,
    videos: data.videos ?? undefined,
    category: data.category,
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
    // for back-in-stock notifications, since the delete-then-recreate below discards it.
    const oldState = await prisma.product.findUnique({
      where: { id: existingId },
      select: { inventoryPolicy: true, sizes: { select: { name: true, quantity: true } } },
    });

    await prisma.$transaction([
      prisma.productColor.deleteMany({ where: { productId: existingId } }),
      prisma.productSize.deleteMany({ where: { productId: existingId } }),
      prisma.productCollection.deleteMany({ where: { productId: existingId } }),
      prisma.product.update({
        where: { id: existingId },
        data: { ...toProductWriteData(data), ...nestedWrites },
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
    data: { ...toProductWriteData(data), ...nestedWrites },
  });
  return { id: product.id };
}
