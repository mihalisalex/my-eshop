"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/admin-session";
import { giftCardFormSchema, type GiftCardFormValues } from "@/lib/validation/gift-card";

export interface GiftCardActionState {
  error?: string;
}

function revalidateStorefront() {
  revalidatePath("/", "layout");
}

export async function createGiftCard(values: GiftCardFormValues): Promise<GiftCardActionState> {
  await requireCapability("catalog:discounts");
  const parsed = giftCardFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const existing = await prisma.giftCard.findUnique({ where: { code: data.code } });
  if (existing) return { error: "A gift card with this code already exists." };

  await prisma.giftCard.create({
    data: { code: data.code, balanceAmount: data.balanceAmount, active: data.active },
  });

  revalidateStorefront();
  redirect("/admin/gift-cards");
}

/** No redirect — called from the list page itself, not a detail page (gift cards have no detail page). */
export async function toggleGiftCardActive(id: string, active: boolean): Promise<void> {
  await requireCapability("catalog:discounts");
  await prisma.giftCard.update({ where: { id }, data: { active } });
  revalidateStorefront();
}

export async function deleteGiftCard(id: string): Promise<void> {
  await requireCapability("catalog:discounts");
  await prisma.giftCard.delete({ where: { id } });
  revalidateStorefront();
}
