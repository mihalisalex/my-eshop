import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { DataTable } from "@/components/admin/DataTable";
import { formatDate, formatMoney } from "@/lib/format";
import { getDashboardStats } from "@/services";
import { getAllOrdersForAdmin } from "@/services/orders";
import type { Order } from "@/lib/commerce/types";

export default async function AdminDashboardPage() {
  const [stats, orders] = await Promise.all([getDashboardStats(), getAllOrdersForAdmin()]);
  const recentOrders = orders.slice(0, 5);

  return (
    <div>
      <AdminPageHeader title="Dashboard" description="An overview of how the store is performing." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.id} {...stat} />
        ))}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium tracking-[0.05em] uppercase">Recent Orders</h3>
          <Link href="/admin/orders" className="text-xs text-luxe-gray-dark underline underline-offset-4">
            View all
          </Link>
        </div>
        <DataTable<Order>
          columns={[
            { header: "Order", cell: (row) => row.id },
            {
              header: "Customer",
              cell: (row) => `${row.shippingAddress.firstName} ${row.shippingAddress.lastName}`,
            },
            { header: "Date", cell: (row) => formatDate(row.createdAt) },
            {
              header: "Status",
              cell: (row) => <span className="capitalize">{row.status}</span>,
            },
            {
              header: "Total",
              cell: (row) => formatMoney(row.totals.total),
              className: "text-right",
            },
          ]}
          rows={recentOrders}
          getRowKey={(row) => row.id}
        />
      </div>
    </div>
  );
}
