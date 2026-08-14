import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { ActiveToggle } from "@/components/admin/ActiveToggle";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { formatMoney } from "@/lib/format";
import { getAllGiftCards } from "@/services/gift-cards";
import { toggleGiftCardActive, deleteGiftCard } from "@/app/admin/(dashboard)/gift-cards/actions";
import type { GiftCard } from "@/types";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";

export default async function AdminGiftCardsPage() {
  await requireCapabilityOrRedirect("catalog:discounts");
  const giftCards = await getAllGiftCards();

  return (
    <div>
      <AdminPageHeader
        title="Gift Cards"
        description={`${giftCards.length} gift card codes.`}
        actions={
          <Link
            href="/admin/gift-cards/new"
            className="flex h-9 items-center bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase"
          >
            New Gift Card
          </Link>
        }
      />

      <DataTable<GiftCard>
        columns={[
          { header: "Code", cell: (row) => <span className="font-mono">{row.code}</span> },
          { header: "Balance", cell: (row) => formatMoney(row.balance) },
          {
            header: "Status",
            cell: (row) => <ActiveToggle id={row.id} defaultActive={row.active} onToggle={toggleGiftCardActive} />,
          },
          {
            header: "",
            cell: (row) => <DeleteRowButton id={row.id} onDelete={deleteGiftCard} confirmMessage={`Delete ${row.code}?`} />,
            className: "text-right",
          },
        ]}
        rows={giftCards}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
