import "server-only";
import { prisma } from "@/lib/prisma";
import type { GiftCard } from "@/types";
import { toGiftCard } from "@/lib/commerce/postgres/mappers";

export async function getAllGiftCards(): Promise<GiftCard[]> {
  const rows = await prisma.giftCard.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toGiftCard);
}

export async function getGiftCardByCode(code: string): Promise<GiftCard | null> {
  const row = await prisma.giftCard.findUnique({ where: { code: code.trim().toUpperCase() } });
  return row ? toGiftCard(row) : null;
}
