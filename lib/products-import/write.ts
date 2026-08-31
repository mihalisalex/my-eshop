import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyBackInStockIfNeeded } from "@/lib/products-import/back-in-stock";
import { findOrCreateCategoryBySlug } from "@/services/categories";
import { normalizeSeoOverride, type ProductFormValues } from "@/lib/validation/product";

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
    // `Prisma.DbNull`, NOT `undefined`, for these two nullable Json columns. `undefined`
    // is Prisma's "leave this column alone" (see resolveArchivedAt above, which relies on
    // exactly that), so on an UPDATE it silently preserves the previous value instead of
    // clearing it — removing every video from a product, or blanking its SEO override,
    // would appear to save and change nothing. Only the create path was ever correct.
    videos: data.videos?.length ? data.videos : Prisma.DbNull,
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
    // Blank-but-present SEO fields are collapsed away here rather than stored as empty
    // strings — see normalizeSeoOverride for why "" is not the same as absent, and the
    // note on `videos` above for why the empty case must be DbNull rather than undefined.
    seo: normalizeSeoOverride(data.seo) ?? Prisma.DbNull,
  };
}

/**
 * What a size's stock should become.
 *
 * With a baseline, the submitted number is read as an INTENT TO CHANGE BY a delta rather
 * than as the new absolute value, so a concurrent sale between form load and form save is
 * preserved instead of being overwritten. Load at 3, sell one, save an untouched 3:
 * delta 0, and the shelf stays at 2 rather than jumping back to 3.
 *
 * Without a baseline — a newly added size, or any CSV import row — the submitted number is
 * authoritative and applied as-is.
 *
 * Clamped at zero either way: negative stock is not a state this app has ever modelled
 * (see services/restock.ts), and the database now refuses it outright.
 */
export function resolveSizeQuantity(
  submitted: number,
  baseline: number | undefined,
  current: number
): number {
  if (baseline === undefined || !Number.isFinite(baseline)) return Math.max(0, submitted);
  return Math.max(0, current + (submitted - baseline));
}

/**
 * The one write path for a validated product row. Shared by the single-product admin form
 * (app/admin/(dashboard)/products/actions.ts) and the CSV bulk-import tool's commit route,
 * so there's exactly one place this logic can drift.
 *
 * Colors and collections are still fully replaced on update — they hold no state worth
 * preserving, so there's nothing to lose by recreating them. SIZES ARE NOT, because they
 * hold stock: delete-then-recreate wrote the form's (or the CSV's) quantity back
 * unconditionally, which is a lost update every time the shelf moved while the form was
 * open. They are now reconciled by name, which is also the key BackInStockRequest already
 * uses, so nothing downstream needed a stable id it wasn't already living without.
 */
export async function writeProductRow(data: ProductFormValues, existingId?: string): Promise<{ id: string }> {
  const { id: categoryId } = await findOrCreateCategoryBySlug(data.category);

  const colorWrites = {
    create: data.colors.map((color, position) => ({
      position,
      name: color.name,
      hex: color.hex,
      imageSrc: color.imageSrc,
      imageAlt: color.imageAlt,
    })),
  };
  const collectionWrites = {
    create: data.collectionIds.map((collectionId, position) => ({ collectionId, position })),
  };

  if (existingId) {
    // Read before the transaction — needed to diff old vs. new per-size purchasability for
    // back-in-stock notifications, and to tell a real archive transition from a save of an
    // already-archived product.
    const oldState = await prisma.product.findUnique({
      where: { id: existingId },
      select: {
        slug: true,
        inventoryPolicy: true,
        status: true,
        sizes: { select: { id: true, name: true, quantity: true } },
      },
    });
    const currentSizes = oldState?.sizes ?? [];
    const currentByName = new Map(currentSizes.map((size) => [size.name, size]));
    const submittedNames = new Set(data.sizes.map((size) => size.name));

    // Computed before the transaction opens so the resulting quantities can also be handed
    // to the back-in-stock diff below — which must compare against what was actually
    // written, not against what was submitted. Those are no longer the same number.
    const resolvedSizes = data.sizes.map((size, position) => {
      const current = currentByName.get(size.name);
      return {
        current,
        position,
        name: size.name,
        inStock: size.inStock,
        quantity: resolveSizeQuantity(size.quantity, size.quantityBaseline, current?.quantity ?? 0),
        sku: size.sku ?? null,
        barcode: size.barcode ?? null,
      };
    });
    const removedSizeIds = currentSizes.filter((size) => !submittedNames.has(size.name)).map((size) => size.id);

    /**
     * A rename records the outgoing slug so the old URL keeps working — see
     * ProductSlugHistory, and updateCategory, which does exactly this for categories.
     *
     * It happens inside the same transaction as the rename because a rename that committed
     * without its history row would silently 404 a ranked URL, and nothing would report it.
     * The CSV import path can never reach this branch with a changed slug (it looks the
     * product up BY slug), so this only ever fires for a real admin rename.
     */
    const slugChanged = Boolean(oldState) && oldState!.slug !== data.slug;

    await prisma.$transaction([
      ...(slugChanged
        ? [
            prisma.productSlugHistory.upsert({
              where: { slug: oldState!.slug },
              create: { slug: oldState!.slug, productId: existingId },
              // If this slug was previously retired by ANOTHER product and is now being
              // released again, the newest owner wins — that's who a visitor should land on.
              update: { productId: existingId },
            }),
            // The incoming slug may itself be an old slug of this product (a rename
            // reverted). Leaving that row would redirect the now-live URL back to itself.
            prisma.productSlugHistory.deleteMany({ where: { slug: data.slug } }),
          ]
        : []),
      prisma.productColor.deleteMany({ where: { productId: existingId } }),
      prisma.productCollection.deleteMany({ where: { productId: existingId } }),
      // A size dropped from the form is still deleted — removing a size is a real edit.
      // Only the ones that survive keep their row, and with it their stock.
      ...(removedSizeIds.length > 0
        ? [prisma.productSize.deleteMany({ where: { id: { in: removedSizeIds } } })]
        : []),
      ...resolvedSizes.map(({ current, ...size }) =>
        current
          ? prisma.productSize.update({ where: { id: current.id }, data: size })
          : prisma.productSize.create({ data: { productId: existingId, ...size } })
      ),
      prisma.product.update({
        where: { id: existingId },
        data: {
          ...toProductWriteData(data, categoryId, oldState?.status),
          colors: colorWrites,
          collections: collectionWrites,
        },
      }),
    ]);

    if (oldState) {
      try {
        await notifyBackInStockIfNeeded(
          existingId,
          oldState,
          data,
          resolvedSizes.map(({ name, quantity }) => ({ name, quantity }))
        );
      } catch (error) {
        console.error("Failed to process back-in-stock notifications", error);
      }
    }

    return { id: existingId };
  }

  const product = await prisma.product.create({
    data: {
      ...toProductWriteData(data, categoryId),
      colors: colorWrites,
      collections: collectionWrites,
      sizes: {
        // Nothing exists yet, so every quantity here is authoritative by definition.
        create: data.sizes.map((size, position) => ({
          position,
          name: size.name,
          inStock: size.inStock,
          quantity: Math.max(0, size.quantity),
          sku: size.sku,
          barcode: size.barcode,
        })),
      },
    },
  });
  return { id: product.id };
}
