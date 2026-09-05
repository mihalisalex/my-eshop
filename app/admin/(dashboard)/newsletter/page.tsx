import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { formatDate } from "@/lib/format";
import { getNewsletterSubscribers } from "@/services";
import type { NewsletterSubscriber } from "@/types";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminNewsletterPage() {
  const subscribers = await getNewsletterSubscribers();

  return (
    <div>
      <AdminPageHeader
        title="Newsletter Subscribers"
        description={`${subscribers.length} subscribers, captured from the site's signup forms.`}
        actions={
          <button
            type="button"
            className="h-9 border border-border px-4 text-xs font-medium tracking-[0.05em] uppercase"
          >
            Export CSV
          </button>
        }
      />

      <DataTable<NewsletterSubscriber>
        columns={[
          { header: "Email", cell: (row) => row.email },
          { header: "Source", cell: (row) => row.source ?? "—" },
          { header: "Subscribed", cell: (row) => formatDate(row.subscribedAt) },
        ]}
        rows={subscribers}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
