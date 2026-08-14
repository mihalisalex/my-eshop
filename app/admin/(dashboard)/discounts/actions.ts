"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/admin-session";
import { discountFormSchema, type DiscountFormValues } from "@/lib/validation/discount";

export interface DiscountActionState {
  error?: string;
}

function revalidateStorefront() {
  revalidatePath("/", "layout");
}

export async function createDiscount(values: DiscountFormValues): Promise<DiscountActionState> {
  await requireCapability("catalog:discounts");
  const parsed = discountFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const existing = await prisma.discount.findUnique({ where: { code: data.code } });
  if (existing) return { error: "A discount with this code already exists." };

  await prisma.discount.create({
    data: {
      code: data.code,
      type: data.type,
      value: data.value,
      active: data.active,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });

  revalidateStorefront();
  redirect("/admin/discounts");
}

/** No redirect — called from the list page itself, not a detail page (discounts have no detail page). */
export async function toggleDiscountActive(id: string, active: boolean): Promise<void> {
  await requireCapability("catalog:discounts");
  await prisma.discount.update({ where: { id }, data: { active } });
  revalidateStorefront();
}

export async function deleteDiscount(id: string): Promise<void> {
  await requireCapability("catalog:discounts");
  await prisma.discount.delete({ where: { id } });
  revalidateStorefront();
}
