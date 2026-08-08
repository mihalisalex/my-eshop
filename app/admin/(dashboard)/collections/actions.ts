"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { capabilityDenied, requireCapability } from "@/lib/admin-session";
import { collectionFormSchema, type CollectionFormValues } from "@/lib/validation/collection";

export interface CollectionActionState {
  error?: string;
}

/** Same rationale as products/actions.ts — nothing in this phase can compute the precise set of affected storefront pages. */
function revalidateStorefront() {
  revalidatePath("/", "layout");
}

function toCollectionWriteData(data: CollectionFormValues) {
  return {
    slug: data.slug,
    title: data.title,
    subtitle: data.subtitle ?? null,
    description: data.description ?? null,
    image: data.image,
    ctaLabel: data.ctaLabel ?? null,
    ctaHref: data.ctaHref ?? null,
    ctaVariant: data.ctaVariant ?? null,
  };
}

export async function createCollection(values: CollectionFormValues): Promise<CollectionActionState> {
  const denied = await capabilityDenied("catalog:edit");
  if (denied) return { error: denied };
  const parsed = collectionFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const existing = await prisma.collection.findUnique({ where: { slug: data.slug } });
  if (existing) return { error: "A collection with this slug already exists." };

  const collection = await prisma.collection.create({
    data: {
      ...toCollectionWriteData(data),
      products: { create: data.productIds.map((productId, position) => ({ productId, position })) },
    },
  });

  revalidateStorefront();
  redirect(`/admin/collections/${collection.id}`);
}

export async function updateCollection(id: string, values: CollectionFormValues): Promise<CollectionActionState> {
  const denied = await capabilityDenied("catalog:edit");
  if (denied) return { error: denied };
  const parsed = collectionFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const existing = await prisma.collection.findUnique({ where: { slug: data.slug } });
  if (existing && existing.id !== id) return { error: "A collection with this slug already exists." };

  await prisma.$transaction([
    prisma.productCollection.deleteMany({ where: { collectionId: id } }),
    prisma.collection.update({
      where: { id },
      data: {
        ...toCollectionWriteData(data),
        products: { create: data.productIds.map((productId, position) => ({ productId, position })) },
      },
    }),
  ]);

  revalidateStorefront();
  redirect(`/admin/collections/${id}`);
}

export async function deleteCollection(id: string): Promise<void> {
  await requireCapability("catalog:delete");
  await prisma.collection.delete({ where: { id } });
  revalidateStorefront();
  redirect("/admin/collections");
}
