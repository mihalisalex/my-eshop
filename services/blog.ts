import "server-only";
import { prisma } from "@/lib/prisma";
import { imageSchema } from "@/lib/validation/product";
import { toJsonInput } from "@/lib/commerce/postgres/mappers";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { BlogPost } from "@/types";

function toBlogPost(row: Prisma.BlogPostGetPayload<object>): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content ?? undefined,
    coverImage: imageSchema.parse(row.coverImage),
    author: row.author,
    tags: row.tags,
    publishedAt: row.publishedAt.toISOString(),
  };
}

export async function getAllPosts(): Promise<BlogPost[]> {
  const rows = await prisma.blogPost.findMany({ orderBy: { publishedAt: "desc" } });
  return rows.map(toBlogPost);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const row = await prisma.blogPost.findUnique({ where: { slug } });
  return row ? toBlogPost(row) : undefined;
}

export async function getPostById(id: string): Promise<BlogPost | undefined> {
  const row = await prisma.blogPost.findUnique({ where: { id } });
  return row ? toBlogPost(row) : undefined;
}

export interface BlogPostInput {
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  coverImage: BlogPost["coverImage"];
  author: string;
  tags: string[];
  publishedAt: string;
}

export async function createPost(input: BlogPostInput): Promise<BlogPost> {
  const row = await prisma.blogPost.create({
    data: {
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      content: input.content,
      coverImage: toJsonInput(imageSchema.parse(input.coverImage)),
      author: input.author,
      tags: input.tags,
      publishedAt: new Date(input.publishedAt),
    },
  });
  return toBlogPost(row);
}

export async function updatePost(id: string, input: BlogPostInput): Promise<BlogPost> {
  const row = await prisma.blogPost.update({
    where: { id },
    data: {
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      content: input.content,
      coverImage: toJsonInput(imageSchema.parse(input.coverImage)),
      author: input.author,
      tags: input.tags,
      publishedAt: new Date(input.publishedAt),
    },
  });
  return toBlogPost(row);
}

export async function deletePost(id: string): Promise<void> {
  await prisma.blogPost.delete({ where: { id } });
}
