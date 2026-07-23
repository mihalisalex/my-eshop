import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { formatDate } from "@/lib/format";
import { getAllEmailLogsForAdmin, type EmailLogEntry } from "@/services/emails";

const TEMPLATE_LABELS: Record<string, string> = {
  "order-confirmation": "Order Confirmation",
  "shipping-update": "Shipping Update",
  "password-reset": "Password Reset",
  "return-status-update": "Return Status Update",
  welcome: "Welcome",
  "contact-message": "Contact Message",
  "referral-reward": "Referral Reward",
  "abandoned-cart": "Abandoned Cart",
  "review-request": "Review Request",
  "back-in-stock": "Back in Stock",
};

export default async function AdminEmailsPage() {
  const emails = await getAllEmailLogsForAdmin();

  return (
    <div>
      <AdminPageHeader
        title="Emails"
        description={`${emails.length} emails sent through the dev provider. Every order confirmation, shipping update, and password reset gets logged here instead of a real inbox — see lib/email/ to wire up a real provider.`}
      />

      <DataTable<EmailLogEntry>
        columns={[
          {
            header: "To",
            cell: (row) => (
              <Link href={`/admin/emails/${row.id}`} className="hover:underline">
                {row.to}
              </Link>
            ),
          },
          { header: "Template", cell: (row) => TEMPLATE_LABELS[row.template] ?? row.template },
          { header: "Subject", cell: (row) => row.subject },
          { header: "Sent", cell: (row) => formatDate(row.sentAt), className: "text-right" },
        ]}
        rows={emails}
        getRowKey={(row) => row.id}
        emptyMessage="No emails sent yet."
      />
    </div>
  );
}
