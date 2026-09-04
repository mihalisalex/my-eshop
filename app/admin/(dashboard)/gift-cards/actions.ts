"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/admin-session";
import { recordAdminAction } from "@/services/audit-log";
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

  const created = await prisma.giftCard.create({
    data: { code: data.code, balanceAmount: data.balanceAmount, active: data.active },
  });

  // OBS-003. A gift card is a money instrument — issuing one creates a liability against
  // the shop, which puts it in the same class as a refund.
  await recordAdminAction({
    action: "giftCard.created",
    targetType: "giftCard",
    targetId: created.id,
    summary: `Issued gift card ${data.code} with a balance of ${data.balanceAmount}`,
    metadata: { code: data.code, balanceAmount: data.balanceAmount, active: data.active },
  });

  revalidateStorefront();
  redirect("/admin/gift-cards");
}

/** No redirect — called from the list page itself, not a detail page (gift cards have no detail page). */
export async function toggleGiftCardActive(id: string, active: boolean): Promise<void> {
  await requireCapability("catalog:discounts");
  const card = await prisma.giftCard.update({ where: { id }, data: { active } });
  await recordAdminAction({
    action: "giftCard.updated",
    targetType: "giftCard",
    targetId: id,
    summary: `${active ? "Activated" : "Deactivated"} gift card ${card.code}`,
    metadata: { code: card.code, active },
  });
  revalidateStorefront();
}

export async function deleteGiftCard(id: string): Promise<void> {
  await requireCapability("catalog:discounts");
  // Read before the delete: the balance destroyed is the fact worth recording, and after
  // the row is gone there is nothing to read it from.
  const card = await prisma.giftCard.findUnique({
    where: { id },
    select: { code: true, balanceAmount: true },
  });
  await prisma.giftCard.delete({ where: { id } });
  await recordAdminAction({
    action: "giftCard.deleted",
    targetType: "giftCard",
    targetId: id,
    summary: `Deleted gift card ${card?.code ?? id} holding ${card?.balanceAmount ?? "an unknown balance"}`,
    metadata: { code: card?.code, balanceAmount: card?.balanceAmount },
  });
  revalidateStorefront();
}
