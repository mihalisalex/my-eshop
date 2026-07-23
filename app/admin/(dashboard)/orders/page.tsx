import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { formatDate, formatMoney } from "@/lib/format";
import { getAllOrdersForAdmin } from "@/services/orders";
import { updateOrderStatusAction } from "@/app/admin/(dashboard)/orders/actions";
import type { Order } from "@/lib/commerce/types";

export default async function AdminOrdersPage() {
  const orders = await getAllOrdersForAdmin();

  return (
    <div>
      <AdminPageHeader title="Orders" description={`${orders.length} orders.`} />

      <DataTable<Order>
        columns={[
          {
            header: "Order",
            cell: (row) => (
              <Link href={`/admin/orders/${row.id}`} className="font-mono text-xs hover:underline">
                #{row.id.slice(-8).toUpperCase()}
              </Link>
            ),
          },
          {
            header: "Customer",
            cell: (row) => (
              <div>
                <p>
                  {row.shippingAddress.firstName} {row.shippingAddress.lastName}
                </p>
                <p className="text-xs text-luxe-gray-dark">{row.customerEmail}</p>
              </div>
            ),
          },
          { header: "Date", cell: (row) => formatDate(row.createdAt) },
          {
            header: "Status",
            cell: (row) => (
              <OrderStatusSelect orderId={row.id} defaultStatus={row.status} onChange={updateOrderStatusAction} />
            ),
          },
          {
            header: "Total",
            cell: (row) => formatMoney(row.totals.total),
            className: "text-right",
          },
        ]}
        rows={orders}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
