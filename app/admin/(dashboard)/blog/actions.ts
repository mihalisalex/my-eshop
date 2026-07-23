"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-session";
import { createPost, deletePost, updatePost } from "@/services/blog";
import { blogFormSchema, type BlogFormValues } from "@/lib/validation/blog";

export interface BlogActionState {
  error?: string;
}

function revalidateStorefront() {
  revalidatePath("/", "layout");
}

export async function createBlogPost(values: BlogFormValues): Promise<BlogActionState> {
  await requireAdminSession();
  const parsed = blogFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const existing = await prisma.blogPost.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) return { error: "A post with this slug already exists." };

  const post = await createPost(parsed.data);
  revalidateStorefront();
  redirect(`/admin/blog/${post.id}`);
}

export async function updateBlogPost(id: string, values: BlogFormValues): Promise<BlogActionState> {
  await requireAdminSession();
  const parsed = blogFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const existing = await prisma.blogPost.findUnique({ where: { slug: parsed.data.slug } });
  if (existing && existing.id !== id) return { error: "A post with this slug already exists." };

  await updatePost(id, parsed.data);
  revalidateStorefront();
  redirect(`/admin/blog/${id}`);
}

export async function deleteBlogPost(id: string): Promise<void> {
  await requireAdminSession();
  await deletePost(id);
  revalidateStorefront();
  redirect("/admin/blog");
}
