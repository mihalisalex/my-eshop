import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { getActivityLog } from "@/services";
import type { ActivityLogEntry } from "@/types";

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminActivityPage() {
  const entries = await getActivityLog();

  return (
    <div>
      <AdminPageHeader title="Activity Log" description="Recent actions taken across this dashboard." />

      <DataTable<ActivityLogEntry>
        columns={[
          { header: "When", cell: (row) => formatTimestamp(row.createdAt), className: "whitespace-nowrap" },
          { header: "Who", cell: (row) => row.actor },
          { header: "Action", cell: (row) => row.action },
          { header: "Target", cell: (row) => row.target, className: "text-luxe-gray-dark" },
        ]}
        rows={entries}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
