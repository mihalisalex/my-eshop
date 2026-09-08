import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { EraseCustomerDataForm, ExportCustomerDataForm } from "@/components/admin/DataSubjectPanel";
import { currentRoleHasCapability } from "@/lib/admin-session";
import { formatDate } from "@/lib/format";
import { getAllCustomersForAdmin } from "@/services/customers";
import type { Customer } from "@/lib/commerce/types";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type AdminCustomerRow = Customer & { ordersCount: number; totalSpent: number };

export default async function AdminCustomersPage() {
  // Data-subject work sits with whoever owns the shop's legal obligations, not with whoever
  // is editing the catalogue, so the panel is hidden from roles without `admin:settings`.
  // Both actions re-check the capability themselves; this only keeps a dead control off the page.
  const [customers, canHandleDataRequests] = await Promise.all([
    getAllCustomersForAdmin(),
    currentRoleHasCapability("admin:settings"),
  ]);

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

      {canHandleDataRequests ? (
        <section className="mt-10">
          <h2 className="text-sm font-medium tracking-[0.05em] uppercase">Data requests</h2>
          <p className="mt-1 max-w-2xl text-xs text-luxe-gray-dark">
            Someone can ask for a copy of everything you hold on them, or ask you to delete it. Both have a
            one-month deadline under GDPR. Search by email — these cover guests and subscribers too, not only
            the accounts listed above.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ExportCustomerDataForm />
            <EraseCustomerDataForm />
          </div>
        </section>
      ) : null}
    </div>
  );
}
