import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { formatDate } from "@/lib/format";
import { getAllContactMessagesForAdmin, type ContactMessage } from "@/services/contact";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminMessagesPage() {
  const messages = await getAllContactMessagesForAdmin();

  return (
    <div>
      <AdminPageHeader title="Contact Messages" description={`${messages.length} messages submitted via the Contact page.`} />

      <DataTable<ContactMessage>
        columns={[
          {
            header: "From",
            cell: (row) => (
              <div>
                <p>{row.name}</p>
                <p className="text-xs text-luxe-gray-dark">{row.email}</p>
              </div>
            ),
          },
          { header: "Topic", cell: (row) => row.subject },
          { header: "Message", cell: (row) => <span className="line-clamp-2 max-w-md text-luxe-gray-dark">{row.message}</span> },
          { header: "Received", cell: (row) => formatDate(row.createdAt) },
        ]}
        rows={messages}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
