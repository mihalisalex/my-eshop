"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-session";
import { productFormSchema, type ProductFormValues } from "@/lib/validation/product";

export interface ProductActionState {
  error?: string;
}

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

/** Revalidating the whole tree is a blunt instrument, but correct: nothing in this phase can compute the precise set of storefront pages (PLPs, collections, related-product cross-links) affected by an arbitrary catalog edit. */
function revalidateStorefront() {
  revalidatePath("/", "layout");
}

export async function createProduct(values: ProductFormValues): Promise<ProductActionState> {
  await requireAdminSession();
  const parsed = productFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
  if (existing) return { error: "A product with this slug already exists." };

  const product = await prisma.product.create({
    data: {
      ...toProductWriteData(data),
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
    },
  });

  revalidateStorefront();
  redirect(`/admin/products/${product.id}`);
}

export async function updateProduct(id: string, values: ProductFormValues): Promise<ProductActionState> {
  await requireAdminSession();
  const parsed = productFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
  if (existing && existing.id !== id) return { error: "A product with this slug already exists." };

  await prisma.$transaction([
    prisma.productColor.deleteMany({ where: { productId: id } }),
    prisma.productSize.deleteMany({ where: { productId: id } }),
    prisma.productCollection.deleteMany({ where: { productId: id } }),
    prisma.product.update({
      where: { id },
      data: {
        ...toProductWriteData(data),
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
      },
    }),
  ]);

  revalidateStorefront();
  redirect(`/admin/products/${id}`);
}

export async function deleteProduct(id: string): Promise<void> {
  await requireAdminSession();
  await prisma.product.delete({ where: { id } });
  revalidateStorefront();
  redirect("/admin/products");
}
