"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { capabilityDenied } from "@/lib/admin-session";
import { isSameOrDescendant } from "@/services/categories";
import { categoryFormSchema, type CategoryFormValues } from "@/lib/validation/category";

export interface CategoryActionState {
  error?: string;
}

/** Same rationale as products/actions.ts and collections/actions.ts — nothing in this phase can compute the precise set of affected storefront pages (nav, PLPs, the category's own page, its ancestors' pages). */
function revalidateStorefront() {
  revalidatePath("/", "layout");
}

function normalizeParentId(parentId: string | undefined): string | null {
  return parentId && parentId.trim() !== "" ? parentId : null;
}

/** CategoryFormValues.image is intentionally the lenient `{src?, alt?} | undefined` shape
 * (see lib/validation/category.ts's doc comment on why) — this is where "left blank" (no
 * src) actually becomes "no image" for storage, rather than at validation time. */
function normalizeImage(image: CategoryFormValues["image"]): { src: string; alt: string } | undefined {
  if (!image?.src) return undefined;
  return { src: image.src, alt: image.alt || image.src };
}

function toCategoryWriteData(data: CategoryFormValues, parentId: string | null) {
  const image = normalizeImage(data.image);
  const bannerImage = normalizeImage(data.bannerImage);
  return {
    slug: data.slug,
    name: data.name,
    nameEl: data.nameEl || null,
    description: data.description || null,
    descriptionEl: data.descriptionEl || null,
    parentId,
    // A nullable Json column needs Prisma's JsonNull sentinel to actually clear it — a
    // plain `null` here is ambiguous (Prisma can't tell "set SQL NULL" from "the JS value
    // null", which isn't valid JSON on its own) and fails to typecheck.
    image: image ?? Prisma.JsonNull,
    bannerImage: bannerImage ?? Prisma.JsonNull,
    isFeatured: data.isFeatured,
    isVisible: data.isVisible,
    seo: data.seo ?? undefined,
  };
}

export async function createCategory(values: CategoryFormValues): Promise<CategoryActionState> {
  const denied = await capabilityDenied("catalog:edit");
  if (denied) return { error: denied };
  const parsed = categoryFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const existing = await prisma.category.findUnique({ where: { slug: data.slug } });
  if (existing) return { error: "A category with this slug already exists." };

  const parentId = normalizeParentId(data.parentId);
  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) return { error: "The selected parent category no longer exists." };
  }

  // New category joins at the end of its sibling group.
  const position = await prisma.category.count({ where: { parentId } });

  const category = await prisma.category.create({
    data: { ...toCategoryWriteData(data, parentId), position },
  });

  revalidateStorefront();
  redirect(`/admin/categories/${category.id}`);
}

export async function updateCategory(id: string, values: CategoryFormValues): Promise<CategoryActionState> {
  const denied = await capabilityDenied("catalog:edit");
  if (denied) return { error: denied };
  const parsed = categoryFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const existing = await prisma.category.findUnique({ where: { slug: data.slug } });
  if (existing && existing.id !== id) return { error: "A category with this slug already exists." };

  const current = await prisma.category.findUnique({ where: { id } });
  if (!current) return { error: "This category no longer exists." };

  const parentId = normalizeParentId(data.parentId);
  if (parentId === id) return { error: "A category can't be its own parent." };
  if (parentId && (await isSameOrDescendant(parentId, id))) {
    return { error: "Can't move a category into one of its own subcategories — that would create a loop." };
  }
  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) return { error: "The selected parent category no longer exists." };
  }

  // Moving to a different parent joins at the end of the new sibling group; staying under
  // the same parent keeps its existing position (drag-reorder is the only thing that changes it then).
  const parentChanged = parentId !== current.parentId;
  const position = parentChanged ? await prisma.category.count({ where: { parentId } }) : current.position;

  await prisma.category.update({
    where: { id },
    data: { ...toCategoryWriteData(data, parentId), position },
  });

  revalidateStorefront();
  redirect(`/admin/categories/${id}`);
}

export async function deleteCategory(id: string): Promise<CategoryActionState> {
  const denied = await capabilityDenied("catalog:delete");
  if (denied) return { error: denied };

  const [childCount, productCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.product.count({ where: { categoryId: id } }),
  ]);
  if (childCount > 0) {
    return { error: `This category has ${childCount} subcategor${childCount === 1 ? "y" : "ies"} — move or delete ${childCount === 1 ? "it" : "them"} first.` };
  }
  if (productCount > 0) {
    return { error: `${productCount} product${productCount === 1 ? "" : "s"} still ${productCount === 1 ? "uses" : "use"} this category — reassign ${productCount === 1 ? "it" : "them"} first.` };
  }

  await prisma.category.delete({ where: { id } });
  revalidateStorefront();
  redirect("/admin/categories");
}

/** Drag-and-drop reorder within one parent — `orderedIds` is every sibling under `parentId` (or every root category, if null) in its new order. */
export async function reorderCategories(parentId: string | null, orderedIds: string[]): Promise<CategoryActionState> {
  const denied = await capabilityDenied("catalog:edit");
  if (denied) return { error: denied };

  const siblings = await prisma.category.findMany({ where: { parentId }, select: { id: true } });
  const siblingIds = new Set(siblings.map((s) => s.id));
  if (orderedIds.length !== siblingIds.size || !orderedIds.every((id) => siblingIds.has(id))) {
    return { error: "That reorder didn't match the current sibling list — refresh and try again." };
  }

  await prisma.$transaction(
    orderedIds.map((id, position) => prisma.category.update({ where: { id }, data: { position } }))
  );

  revalidateStorefront();
  return {};
}
