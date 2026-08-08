import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { ReturnStatusSelect } from "@/components/admin/ReturnStatusSelect";
import { formatDate } from "@/lib/format";
import { getAllReturnsForAdmin } from "@/services/returns";
import { updateReturnStatusAction } from "@/app/admin/(dashboard)/returns/actions";
import type { Return } from "@/lib/commerce/types";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";

export default async function AdminReturnsPage() {
  await requireCapabilityOrRedirect("orders:returns");
  const returns = await getAllReturnsForAdmin();

  return (
    <div>
      <AdminPageHeader title="Returns" description={`${returns.length} return requests.`} />

      <DataTable<Return>
        columns={[
          { header: "Return", cell: (row) => <span className="font-mono text-xs">{row.id.slice(-8).toUpperCase()}</span> },
          { header: "Order", cell: (row) => <span className="font-mono text-xs">{row.orderId.slice(-8).toUpperCase()}</span> },
          { header: "Customer", cell: (row) => row.customerEmail },
          {
            header: "Items",
            cell: (row) => (
              <span className="text-luxe-gray-dark">
                {row.items.map((item) => `${item.name} (${item.size})`).join(", ")}
              </span>
            ),
          },
          { header: "Reason", cell: (row) => row.reason, className: "text-luxe-gray-dark" },
          { header: "Requested", cell: (row) => formatDate(row.createdAt) },
          { header: "Status", cell: (row) => <ReturnStatusSelect returnId={row.id} defaultStatus={row.status} onChange={updateReturnStatusAction} /> },
        ]}
        rows={returns}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
