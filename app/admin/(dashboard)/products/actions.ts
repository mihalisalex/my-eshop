"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-session";
import { productFormSchema, type ProductFormValues } from "@/lib/validation/product";
import { writeProductRow } from "@/lib/products-import/write";

export interface ProductActionState {
  error?: string;
}

/** Revalidating the whole tree is a blunt instrument, but correct: nothing in this phase can compute the precise set of storefront pages (PLPs, collections, related-product cross-links) affected by an arbitrary catalog edit. */
function revalidateStorefront() {
  revalidatePath("/", "layout");
}

export async function createProduct(values: ProductFormValues): Promise<ProductActionState> {
  await requireAdminSession();
  const parsed = productFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
  if (existing) return { error: "A product with this slug already exists." };

  const { id } = await writeProductRow(data);

  revalidateStorefront();
  redirect(`/admin/products/${id}`);
}

export async function updateProduct(id: string, values: ProductFormValues): Promise<ProductActionState> {
  await requireAdminSession();
  const parsed = productFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
  if (existing && existing.id !== id) return { error: "A product with this slug already exists." };

  await writeProductRow(data, id);

  revalidateStorefront();
  redirect(`/admin/products/${id}`);
}

export async function deleteProduct(id: string): Promise<void> {
  await requireAdminSession();
  await prisma.product.delete({ where: { id } });
  revalidateStorefront();
  redirect("/admin/products");
}
