import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { ActiveToggle } from "@/components/admin/ActiveToggle";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { formatDate } from "@/lib/format";
import { getAllDiscounts } from "@/services/discounts";
import { toggleDiscountActive, deleteDiscount } from "@/app/admin/(dashboard)/discounts/actions";
import type { Discount } from "@/types";

export default async function AdminDiscountsPage() {
  const discounts = await getAllDiscounts();

  return (
    <div>
      <AdminPageHeader
        title="Discounts"
        description={`${discounts.length} discount codes.`}
        actions={
          <Link
            href="/admin/discounts/new"
            className="flex h-9 items-center bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase"
          >
            New Discount
          </Link>
        }
      />

      <DataTable<Discount>
        columns={[
          { header: "Code", cell: (row) => <span className="font-mono">{row.code}</span> },
          {
            header: "Value",
            cell: (row) => (row.type === "percentage" ? `${row.value}%` : `€${row.value.toFixed(2)}`),
          },
          { header: "Expires", cell: (row) => (row.expiresAt ? formatDate(row.expiresAt) : "No expiry") },
          {
            header: "Status",
            cell: (row) => <ActiveToggle id={row.id} defaultActive={row.active} onToggle={toggleDiscountActive} />,
          },
          {
            header: "",
            cell: (row) => <DeleteRowButton id={row.id} onDelete={deleteDiscount} confirmMessage={`Delete ${row.code}?`} />,
            className: "text-right",
          },
        ]}
        rows={discounts}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
