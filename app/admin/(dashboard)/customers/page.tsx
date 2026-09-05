import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { formatDate } from "@/lib/format";
import { getAllCustomersForAdmin } from "@/services/customers";
import type { Customer } from "@/lib/commerce/types";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type AdminCustomerRow = Customer & { ordersCount: number; totalSpent: number };

export default async function AdminCustomersPage() {
  const customers = await getAllCustomersForAdmin();

  return (
    <div>
      <AdminPageHeader title="Customers" description={`${customers.length} customers.`} />

      <DataTable<AdminCustomerRow>
        columns={[
          {
            header: "Customer",
            cell: (row) => (
              <div>
                <p>
                  {row.firstName} {row.lastName}
                </p>
                <p className="text-xs text-luxe-gray-dark">{row.email}</p>
              </div>
            ),
          },
          { header: "Orders", cell: (row) => row.ordersCount },
          { header: "Total Spent", cell: (row) => `€${row.totalSpent.toFixed(2)}` },
          { header: "Joined", cell: (row) => formatDate(row.createdAt) },
        ]}
        rows={customers}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
