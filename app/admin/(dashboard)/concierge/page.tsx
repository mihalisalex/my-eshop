import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { ConciergeStatusSelect } from "@/components/admin/ConciergeStatusSelect";
import { formatDate } from "@/lib/format";
import { getAllConciergeRequestsForAdmin, type ConciergeRequest } from "@/services/concierge";
import { updateConciergeStatusAction } from "@/app/admin/(dashboard)/concierge/actions";

export default async function AdminConciergePage() {
  const requests = await getAllConciergeRequestsForAdmin();

  return (
    <div>
      <AdminPageHeader title="Ask a Stylist" description={`${requests.length} styling requests.`} />

      <DataTable<ConciergeRequest>
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
          { header: "Topic", cell: (row) => row.topic },
          { header: "Message", cell: (row) => <span className="line-clamp-2 max-w-md text-luxe-gray-dark">{row.message}</span> },
          { header: "Received", cell: (row) => formatDate(row.createdAt) },
          { header: "Status", cell: (row) => <ConciergeStatusSelect requestId={row.id} defaultStatus={row.status} onChange={updateConciergeStatusAction} /> },
        ]}
        rows={requests}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
