import { z } from "zod";
import { imageSchema } from "@/lib/validation/product";
import type { BlogPost } from "@/types/blog";

const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only");

export const blogFormSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1, "Title is required"),
  excerpt: z.string().min(1, "Excerpt is required"),
  content: z.string().optional(),
  coverImage: imageSchema,
  author: z.string().min(1, "Author is required"),
  tags: z.array(z.string()),
  publishedAt: z.string().min(1, "Publish date is required"),
});

export type BlogFormValues = z.infer<typeof blogFormSchema>;

export function blogPostToFormValues(post: BlogPost): BlogFormValues {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    coverImage: post.coverImage,
    author: post.author,
    tags: post.tags,
    publishedAt: post.publishedAt.slice(0, 10),
  };
}

/** publishedAt is deliberately empty here (not "today") — a module-level constant would freeze to server-start time; the New Post page fills it in per-request instead. */
export const emptyBlogFormValues: BlogFormValues = {
  slug: "",
  title: "",
  excerpt: "",
  coverImage: { src: "", alt: "" },
  author: "",
  tags: [],
  publishedAt: "",
};
