import "server-only";
import { prisma } from "@/lib/prisma";
import type { MediaAsset, MediaAssetWithUsage, MediaUsage } from "@/types/media";

type MediaRow = {
  id: string;
  url: string;
  pathname: string;
  filename: string;
  altText: string | null;
  folder: string | null;
  tags: string[];
  contentType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  createdAt: Date;
};

function toMediaAsset(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    url: row.url,
    pathname: row.pathname,
    filename: row.filename,
    altText: row.altText ?? undefined,
    folder: row.folder ?? undefined,
    tags: row.tags,
    contentType: row.contentType ?? undefined,
    sizeBytes: row.sizeBytes ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getAllMediaAssets(): Promise<MediaAsset[]> {
  const rows = await prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toMediaAsset);
}

export async function getMediaAssetById(id: string): Promise<MediaAsset | undefined> {
  const row = await prisma.mediaAsset.findUnique({ where: { id } });
  return row ? toMediaAsset(row) : undefined;
}

/** Distinct folder labels currently in use, for the library's filter dropdown. */
export async function getMediaFolders(): Promise<string[]> {
  const rows = await prisma.mediaAsset.findMany({
    where: { folder: { not: null } },
    select: { folder: true },
    distinct: ["folder"],
    orderBy: { folder: "asc" },
  });
  return rows.map((r) => r.folder!).filter(Boolean);
}

/**
 * Where a URL is actually referenced.
 *
 * Consumers store image URLs inside Json columns (`Product.images`, `Collection.image`,
 * `Category.image`/`bannerImage`, `BlogPost.coverImage`, `SiteContent.data` for the
 * homepage/hero) rather than as foreign keys, so there's no relation to traverse. Matching
 * on the serialised Json text is what makes a cross-cutting "is this in use" check possible
 * at all — and it's why deletion is gated on it: without this, deleting a library image
 * would silently blank out a live product photo with no warning.
 *
 * The URL is matched as a literal substring, so a URL that is a prefix of another can't
 * produce a false "unused" — only, at worst, an over-cautious false "in use", which fails
 * in the safe direction.
 */
export async function getMediaUsage(url: string): Promise<MediaUsage[]> {
  const needle = `%${url}%`;

  const [products, colors, collections, categories, posts, content] = await Promise.all([
    prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name FROM products WHERE images::text LIKE ${needle} OR videos::text LIKE ${needle} OR seo::text LIKE ${needle}
    `,
    prisma.$queryRaw<{ productId: string; name: string }[]>`
      SELECT pc."productId", p.name FROM product_colors pc JOIN products p ON p.id = pc."productId" WHERE pc."imageSrc" = ${url}
    `,
    prisma.$queryRaw<{ id: string; title: string }[]>`
      SELECT id, title FROM collections WHERE image::text LIKE ${needle}
    `,
    prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name FROM categories WHERE image::text LIKE ${needle} OR "bannerImage"::text LIKE ${needle} OR seo::text LIKE ${needle}
    `,
    prisma.$queryRaw<{ id: string; title: string }[]>`
      SELECT id, title FROM blog_posts WHERE "coverImage"::text LIKE ${needle}
    `,
    prisma.$queryRaw<{ key: string }[]>`
      SELECT key FROM site_content WHERE data::text LIKE ${needle}
    `,
  ]);

  const usage: MediaUsage[] = [];
  for (const p of products) usage.push({ label: `Product: ${p.name}`, href: `/admin/products/${p.id}` });
  for (const c of colors) usage.push({ label: `Product colour: ${c.name}`, href: `/admin/products/${c.productId}` });
  for (const c of collections) usage.push({ label: `Collection: ${c.title}`, href: `/admin/collections/${c.id}` });
  for (const c of categories) usage.push({ label: `Category: ${c.name}`, href: `/admin/categories/${c.id}` });
  for (const p of posts) usage.push({ label: `Blog post: ${p.title}`, href: `/admin/blog/${p.id}` });
  for (const s of content) usage.push({ label: `Site content: ${s.key}`, href: s.key === "homepage" ? "/admin/homepage" : undefined });

  // A product matched by both its images and one of its colours is one place to go fix.
  return usage.filter((u, i) => usage.findIndex((o) => o.label === u.label) === i);
}

/**
 * Usage for the whole library in a fixed number of queries rather than one call to
 * `getMediaUsage` per asset — the grid renders every asset's in-use state at once, so the
 * per-asset version would be an N+1 across six tables.
 */
export async function getAllMediaAssetsWithUsage(): Promise<MediaAssetWithUsage[]> {
  const assets = await getAllMediaAssets();
  if (assets.length === 0) return [];

  const [products, colors, collections, categories, posts, content] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true, images: true, videos: true, seo: true } }),
    prisma.productColor.findMany({ where: { imageSrc: { not: null } }, select: { imageSrc: true, productId: true, product: { select: { name: true } } } }),
    prisma.collection.findMany({ select: { id: true, title: true, image: true } }),
    prisma.category.findMany({ select: { id: true, name: true, image: true, bannerImage: true, seo: true } }),
    prisma.blogPost.findMany({ select: { id: true, title: true, coverImage: true } }),
    prisma.siteContent.findMany({ select: { key: true, data: true } }),
  ]);

  // One serialised haystack per referencing record, scanned once per asset. At catalog
  // scale this is far cheaper than six LIKE queries per asset.
  const haystacks: { text: string; usage: MediaUsage }[] = [
    ...products.map((p) => ({
      text: JSON.stringify([p.images, p.videos, p.seo]),
      usage: { label: `Product: ${p.name}`, href: `/admin/products/${p.id}` },
    })),
    ...colors.map((c) => ({
      text: c.imageSrc ?? "",
      usage: { label: `Product colour: ${c.product.name}`, href: `/admin/products/${c.productId}` },
    })),
    ...collections.map((c) => ({
      text: JSON.stringify(c.image),
      usage: { label: `Collection: ${c.title}`, href: `/admin/collections/${c.id}` },
    })),
    ...categories.map((c) => ({
      text: JSON.stringify([c.image, c.bannerImage, c.seo]),
      usage: { label: `Category: ${c.name}`, href: `/admin/categories/${c.id}` },
    })),
    ...posts.map((p) => ({
      text: JSON.stringify(p.coverImage),
      usage: { label: `Blog post: ${p.title}`, href: `/admin/blog/${p.id}` },
    })),
    ...content.map((s) => ({
      text: JSON.stringify(s.data),
      usage: { label: `Site content: ${s.key}`, href: s.key === "homepage" ? "/admin/homepage" : undefined },
    })),
  ];

  return assets.map((asset) => {
    const usage: MediaUsage[] = [];
    for (const h of haystacks) {
      if (!h.text.includes(asset.url)) continue;
      if (!usage.some((u) => u.label === h.usage.label)) usage.push(h.usage);
    }
    return { ...asset, usage };
  });
}

export interface CreateMediaAssetInput {
  url: string;
  pathname: string;
  filename: string;
  contentType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  altText?: string;
  folder?: string;
  tags?: string[];
}

/**
 * Upsert on `url`: the same file can legitimately be uploaded again (a re-run import, a
 * retried upload), and a duplicate row would show the same image twice in the library and
 * make deletion ambiguous about which row owns the blob.
 */
export async function createMediaAsset(input: CreateMediaAssetInput): Promise<MediaAsset> {
  const row = await prisma.mediaAsset.upsert({
    where: { url: input.url },
    create: {
      url: input.url,
      pathname: input.pathname,
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      width: input.width,
      height: input.height,
      altText: input.altText,
      folder: input.folder,
      tags: input.tags ?? [],
    },
    update: {},
  });
  return toMediaAsset(row);
}

export async function updateMediaAsset(
  id: string,
  data: { altText?: string | null; folder?: string | null; tags?: string[] }
): Promise<MediaAsset> {
  const row = await prisma.mediaAsset.update({ where: { id }, data });
  return toMediaAsset(row);
}

export async function deleteMediaAssetRow(id: string): Promise<void> {
  await prisma.mediaAsset.delete({ where: { id } });
}
