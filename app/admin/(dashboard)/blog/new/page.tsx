import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BlogPostForm } from "@/components/admin/BlogPostForm";
import { createBlogPost } from "@/app/admin/(dashboard)/blog/actions";
import { emptyBlogFormValues } from "@/lib/validation/blog";

export default function NewBlogPostPage() {
  return (
    <div>
      <AdminPageHeader title="New Post" description="Write a new journal post." />
      <BlogPostForm
        defaultValues={{ ...emptyBlogFormValues, publishedAt: new Date().toISOString().slice(0, 10) }}
        onSubmit={createBlogPost}
        submitLabel="Publish Post"
      />
    </div>
  );
}
