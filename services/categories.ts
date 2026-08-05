import "server-only";
import { prisma } from "@/lib/prisma";
import { categoryInclude, toCategory } from "@/lib/commerce/postgres/mappers";
import type { Category, CategoryOption, CategoryWithChildren } from "@/types";

/**
 * Real taxonomy, backed by the `categories` table (see prisma/schema.prisma) — replaced
 * the old "categories are just Product.category strings grouped in JS" placeholder.
 */

export async function getAllCategories(): Promise<Category[]> {
  const rows = await prisma.category.findMany({ include: categoryInclude, orderBy: { position: "asc" } });
  return rows.map(toCategory);
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  const row = await prisma.category.findUnique({ where: { id }, include: categoryInclude });
  return row ? toCategory(row) : undefined;
}

export async function getCategoryBySlug(slug: string): Promise<Category | undefined> {
  const row = await prisma.category.findUnique({ where: { slug }, include: categoryInclude });
  return row ? toCategory(row) : undefined;
}

/** Direct children only, ordered — what the storefront category page shows as sub-category chips. */
export async function getChildCategories(parentId: string): Promise<Category[]> {
  const rows = await prisma.category.findMany({
    where: { parentId },
    include: categoryInclude,
    orderBy: { position: "asc" },
  });
  return rows.map(toCategory);
}

/** Builds the full parent->children tree from one flat query — no N+1 per level. */
export async function getCategoryTree(): Promise<CategoryWithChildren[]> {
  const all = await getAllCategories();
  const byId = new Map<string, CategoryWithChildren>(all.map((c) => [c.id, { ...c, children: [] }]));
  const roots: CategoryWithChildren[] = [];

  for (const category of all) {
    const node = byId.get(category.id)!;
    if (category.parentId && byId.has(category.parentId)) {
      byId.get(category.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Flattened, depth-annotated list for `<select>` pickers (parent picker, product-form category picker). */
export async function getCategoryOptions(excludeSubtreeRootId?: string): Promise<CategoryOption[]> {
  const tree = await getCategoryTree();
  const options: CategoryOption[] = [];

  function walk(nodes: CategoryWithChildren[], depth: number) {
    for (const node of nodes) {
      if (node.id === excludeSubtreeRootId) continue; // also skips its whole subtree below
      options.push({ id: node.id, slug: node.slug, name: node.name, depth });
      walk(node.children, depth + 1);
    }
  }
  walk(tree, 0);
  return options;
}

/**
 * Used by the single shared product write path (lib/products-import/write.ts) for both the
 * admin product form (which only ever submits a slug from a real `<select>`, so this always
 * just finds) and CSV import (whose rows may contain arbitrary free text — "Running Shoes",
 * mixed case, stray spaces — not a clean slug, so this creates it — same "auto-map real
 * business taxonomy" precedent as the WooCommerce import documented in NOTES.md). The input
 * is normalized defensively rather than trusted as already slug-shaped, so a messy CSV
 * column can't produce a Category whose slug breaks the app's `[a-z0-9-]` convention. The
 * created category starts as top-level (no parent) — fully visible and browsable, just
 * needs an admin to place it in the hierarchy and add imagery later.
 */
export async function findOrCreateCategoryBySlug(rawSlug: string): Promise<{ id: string }> {
  const slug = rawSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error(`"${rawSlug}" doesn't contain any usable category name.`);

  const existing = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return existing;

  const name = slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  const created = await prisma.category.create({ data: { slug, name }, select: { id: true } });
  return created;
}

/** True if `candidateId` is `ancestorId` itself or a descendant of it — used to stop a category being re-parented into its own subtree, which would create a cycle. */
export async function isSameOrDescendant(candidateId: string, ancestorId: string): Promise<boolean> {
  if (candidateId === ancestorId) return true;
  const children = await prisma.category.findMany({ where: { parentId: ancestorId }, select: { id: true } });
  for (const child of children) {
    if (await isSameOrDescendant(candidateId, child.id)) return true;
  }
  return false;
}
