import "server-only";
import { prisma } from "@/lib/prisma";
import { categoryInclude, toCategory } from "@/lib/commerce/postgres/mappers";
import type { Category, CategoryOption, CategoryWithChildren } from "@/types";

/**
 * Real taxonomy, backed by the `categories` table (see prisma/schema.prisma) — replaced
 * the old "categories are just Product.category strings grouped in JS" placeholder.
 */

/**
 * `name` is a deliberate tiebreaker, not decoration: `position` is only unique by
 * convention (concurrent creates can hand two siblings the same value, and the original
 * Category backfill left every row at the default 0), and Postgres gives no ordering
 * guarantee for tied rows — it returns heap order, which it rewrites on UPDATE and
 * reshuffles on vacuum. Without this, merchandising order silently changes on its own.
 */
const CATEGORY_ORDER = [{ position: "asc" as const }, { name: "asc" as const }];

export async function getAllCategories(): Promise<Category[]> {
  const rows = await prisma.category.findMany({ include: categoryInclude, orderBy: CATEGORY_ORDER });
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

/**
 * Resolves a slug that a category *used* to have, to that category's CURRENT slug — the
 * lookup behind the permanent redirect on `/category/[slug]`.
 *
 * Returns null when the slug is unknown, and also when it still resolves to the category's
 * present slug, so a redirect is only issued when it would actually change the URL (a
 * self-redirect would be an infinite loop).
 */
export async function resolveRenamedCategorySlug(slug: string): Promise<string | null> {
  const history = await prisma.categorySlugHistory.findUnique({
    where: { slug },
    select: { category: { select: { slug: true, isVisible: true } } },
  });
  if (!history) return null;
  if (history.category.slug === slug) return null;
  // A retired category shouldn't be resurrected via an old URL — 404 like any hidden one.
  if (!history.category.isVisible) return null;
  return history.category.slug;
}

/**
 * The visible ancestors of a category, outermost first, excluding the category itself.
 *
 * Breadcrumbs on a nested category used to read `Home > Sneakers` regardless of depth,
 * throwing away the hierarchy the taxonomy exists to express — both for a reader and in
 * BreadcrumbList markup, where the trail is the whole point.
 *
 * Hidden ancestors are skipped rather than rendered: this shop's gender parents
 * (`gynaikeia`, `andrika`) are deliberately `isVisible: false` because their pages would
 * duplicate /women and /men, so linking to them would send both crawlers and shoppers to a
 * 404. Walks up by parentId with a depth cap — a cycle is impossible through the admin
 * (updateCategory rejects one) but a hand-edited row should not hang a page render.
 */
export async function getCategoryAncestors(categoryId: string): Promise<Category[]> {
  const ancestors: Category[] = [];
  let current = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { parentId: true },
  });

  for (let depth = 0; depth < 10 && current?.parentId; depth += 1) {
    const parent = await prisma.category.findUnique({
      where: { id: current.parentId },
      include: categoryInclude,
    });
    if (!parent) break;
    if (parent.isVisible) ancestors.unshift(toCategory(parent));
    current = { parentId: parent.parentId };
  }

  return ancestors;
}

/** Direct children only, ordered — what the storefront category page shows as sub-category chips. */
export async function getChildCategories(parentId: string): Promise<Category[]> {
  const rows = await prisma.category.findMany({
    where: { parentId },
    include: categoryInclude,
    orderBy: CATEGORY_ORDER,
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

  const name = slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Upsert, not find-then-create: the read and the write aren't atomic, so two imports (or
  // an import racing a product save) referencing the same new category both saw "missing"
  // and both inserted — one then died on the slug unique constraint, failing that row with
  // a confusing error. `upsert` pushes the check into the same statement as the write.
  return prisma.category.upsert({
    where: { slug },
    create: { slug, name },
    update: {},
    select: { id: true },
  });
}

/**
 * Every id in the subtree rooted at `slug`, including the root itself. Resolved with one
 * recursive CTE rather than a query per level — depth is unbounded (the schema allows
 * unlimited nesting) and this runs on every category page load.
 */
export async function getCategorySubtreeIds(slug: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE subtree AS (
      SELECT id FROM categories WHERE slug = ${slug}
      UNION ALL
      SELECT c.id FROM categories c JOIN subtree s ON c."parentId" = s.id
    )
    SELECT id FROM subtree
  `;
  return rows.map((row) => row.id);
}

/**
 * True if `candidateId` is `ancestorId` itself or a descendant of it — stops a category
 * being re-parented into its own subtree, which would orphan that subtree into an
 * unreachable cycle. One recursive CTE; this previously issued a query per node per level.
 */
export async function isSameOrDescendant(candidateId: string, ancestorId: string): Promise<boolean> {
  if (candidateId === ancestorId) return true;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE subtree AS (
      SELECT id FROM categories WHERE id = ${ancestorId}
      UNION ALL
      SELECT c.id FROM categories c JOIN subtree s ON c."parentId" = s.id
    )
    SELECT id FROM subtree WHERE id = ${candidateId} LIMIT 1
  `;
  return rows.length > 0;
}
