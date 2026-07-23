import "server-only";
import { prisma } from "@/lib/prisma";
import { toJsonInput } from "@/lib/commerce/postgres/mappers";

/**
 * Shared read/write for the `SiteContent` key/Json store backing every singleton CMS
 * document (homepage, navigation, SEO defaults, site settings) — one real persistence
 * path instead of four near-identical services each hand-rolling the same upsert.
 * No runtime shape validation here (matches this app's existing rigor level for these
 * documents — the JSON-file versions this replaced were also untyped `as T` casts);
 * the admin editors are the only writers and are already TypeScript-typed client-side.
 */
export async function getSiteContent<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.siteContent.findUnique({ where: { key } });
  return row ? (row.data as T) : fallback;
}

export async function setSiteContent<T>(key: string, data: T): Promise<void> {
  await prisma.siteContent.upsert({
    where: { key },
    create: { key, data: toJsonInput(data) },
    update: { data: toJsonInput(data) },
  });
}
