import "server-only";
import { prisma } from "@/lib/prisma";
import type { Discount } from "@/types";
import { toDiscount } from "@/lib/commerce/postgres/mappers";

export async function getAllDiscounts(): Promise<Discount[]> {
  const rows = await prisma.discount.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toDiscount);
}

export async function getDiscountByCode(code: string): Promise<Discount | null> {
  const row = await prisma.discount.findUnique({ where: { code: code.trim().toUpperCase() } });
  return row ? toDiscount(row) : null;
}
