import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { ListFilterBar } from "@/components/admin/ListFilterBar";
import { Pagination } from "@/components/admin/Pagination";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";
import { formatDate } from "@/lib/format";
import { DEFAULT_PAGE_SIZE, parsePage } from "@/lib/pagination";
import { listAuditLog, type AuditLogEntry } from "@/services/audit-log";

interface AdminActivityPageProps {
  searchParams: Promise<{ action?: string; page?: string }>;
}

/**
 * The admin activity log (OBS-002).
 *
 * Records only what matters: money moved, and who can do what. Everything else would bury
 * those. Read-only by construction — there is no edit or delete here, because a log an
 * admin can edit answers no question worth asking.
 */
export default async function AdminActivityPage({ searchParams }: AdminActivityPageProps) {
  await requireCapabilityOrRedirect("admin:activity");
  const params = await searchParams;

  // Dotted verbs mean a prefix filter works: "payment" catches every payment.* action.
  const action = params.action?.trim() || undefined;
  const { rows, total, page, pageCount, pageSize } = await listAuditLog({
    action,
    page: parsePage(params.page),
    pageSize: DEFAULT_PAGE_SIZE,
  });

  return (
    <div>
      <AdminPageHeader
        title="Activity"
        description={
          total === 0
            ? "Nothing recorded yet. Refunds, manual payment confirmations and role changes appear here."
            : `${total} recorded action${total === 1 ? "" : "s"}.`
        }
      />

      <ListFilterBar
        action="/admin/activity"
        selects={[
          {
            name: "action",
            label: "All actions",
            value: action ?? "",
            // OBS-003 widened the vocabulary, and a filter that does not list a prefix makes
            // those entries effectively unfindable — they are recorded but nobody can reach
            // them. Ordered by how often the answer is actually wanted, money first.
            options: [
              { value: "payment", label: "Payments" },
              { value: "order", label: "Orders" },
              { value: "return", label: "Returns" },
              { value: "giftCard", label: "Gift cards" },
              { value: "discount", label: "Discounts" },
              { value: "product", label: "Products" },
              { value: "review", label: "Reviews" },
              { value: "settings", label: "Settings" },
              { value: "adminUser", label: "Users & roles" },
            ],
          },
        ]}
      />

      <DataTable<AuditLogEntry>
        columns={[
          { header: "When", cell: (row) => formatDate(row.createdAt) },
          { header: "Who", cell: (row) => row.actorEmail },
          { header: "Action", cell: (row) => row.action },
          { header: "What", cell: (row) => row.summary },
          { header: "Target", cell: (row) => `${row.targetType} ${row.targetId.slice(-8)}` },
        ]}
        rows={rows}
        getRowKey={(row) => row.id}
      />

      <Pagination
        basePath="/admin/activity"
        params={{ action }}
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        label="actions"
      />
    </div>
  );
}
