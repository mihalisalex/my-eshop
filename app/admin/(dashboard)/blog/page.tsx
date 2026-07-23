import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { formatDate } from "@/lib/format";
import { getAllPosts } from "@/services";
import type { BlogPost } from "@/types";

export default async function AdminBlogPage() {
  const posts = await getAllPosts();

  return (
    <div>
      <AdminPageHeader
        title="Blog Posts"
        description={`${posts.length} journal posts.`}
        actions={
          <Link
            href="/admin/blog/new"
            className="flex h-9 items-center bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase"
          >
            New Post
          </Link>
        }
      />

      <DataTable<BlogPost>
        columns={[
          {
            header: "Title",
            cell: (row) => (
              <Link href={`/admin/blog/${row.id}`} className="hover:underline">
                <p>{row.title}</p>
                <p className="text-xs text-luxe-gray-dark">/{row.slug}</p>
              </Link>
            ),
          },
          { header: "Author", cell: (row) => row.author },
          { header: "Published", cell: (row) => formatDate(row.publishedAt) },
          { header: "Tags", cell: (row) => row.tags.join(", "), className: "text-luxe-gray-dark" },
        ]}
        rows={posts}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
