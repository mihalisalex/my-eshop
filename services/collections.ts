import "server-only";
import { prisma } from "@/lib/prisma";
import type { Collection } from "@/types";
import { collectionInclude, toCollection } from "@/lib/commerce/postgres/mappers";

export async function getAllCollections(): Promise<Collection[]> {
  const rows = await prisma.collection.findMany({ include: collectionInclude, orderBy: { createdAt: "asc" } });
  return rows.map(toCollection);
}

export async function getCollectionBySlug(slug: string): Promise<Collection | undefined> {
  const row = await prisma.collection.findUnique({ where: { slug }, include: collectionInclude });
  return row ? toCollection(row) : undefined;
}

export async function getCollectionsByIds(ids: string[]): Promise<Collection[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.collection.findMany({
    where: { id: { in: ids } },
    include: collectionInclude,
  });
  const byId = new Map(rows.map((row) => [row.id, toCollection(row)]));
  return ids.map((id) => byId.get(id)).filter((c): c is Collection => Boolean(c));
}
