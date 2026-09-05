import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BlogPostForm } from "@/components/admin/BlogPostForm";
import { updateBlogPost, deleteBlogPost } from "@/app/admin/(dashboard)/blog/actions";
import { blogPostToFormValues } from "@/lib/validation/blog";
import { getPostById } from "@/services/blog";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

interface AdminBlogDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminBlogDetailPage({ params }: AdminBlogDetailPageProps) {
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) notFound();

  const boundUpdate = updateBlogPost.bind(null, id);
  const boundDelete = deleteBlogPost.bind(null, id);

  return (
    <div>
      <AdminPageHeader
        title={post.title}
        description={`/journal/${post.slug}`}
        actions={
          <form action={boundDelete}>
            <button
              type="submit"
              className="h-9 border border-destructive px-4 text-xs font-medium tracking-[0.05em] text-destructive uppercase"
            >
              Delete Post
            </button>
          </form>
        }
      />
      <BlogPostForm defaultValues={blogPostToFormValues(post)} onSubmit={boundUpdate} submitLabel="Save Changes" />
    </div>
  );
}
