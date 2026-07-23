import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { formatDate } from "@/lib/format";
import { getAllReferralsForAdmin, type AdminReferralRow } from "@/services/referrals";

export default async function AdminReferralsPage() {
  const referrals = await getAllReferralsForAdmin();

  return (
    <div>
      <AdminPageHeader title="Referrals" description={`${referrals.length} referral signups.`} />

      <DataTable<AdminReferralRow>
        columns={[
          {
            header: "Referrer",
            cell: (row) => (
              <div>
                <p>{row.referrerName}</p>
                <p className="text-xs text-luxe-gray-dark">{row.referrerEmail}</p>
              </div>
            ),
          },
          { header: "Referred", cell: (row) => row.referredName },
          { header: "Reward", cell: (row) => row.rewardGiftCardCode ?? "—", className: "font-mono text-xs" },
          {
            header: "Status",
            cell: (row) => <span className="capitalize">{row.status}</span>,
          },
          { header: "Signed up", cell: (row) => formatDate(row.createdAt) },
        ]}
        rows={referrals}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
