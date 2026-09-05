import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { MiniBarChart } from "@/components/admin/MiniBarChart";
import { DataTable } from "@/components/admin/DataTable";
import { formatDate } from "@/lib/format";
import { getAllOrdersForAdmin } from "@/services/orders";
import { getAllCustomersForAdmin } from "@/services/customers";
import type { Customer } from "@/lib/commerce/types";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type AdminCustomerRow = Customer & { ordersCount: number; totalSpent: number };

export default async function AdminAnalyticsPage() {
  const [orders, customers] = await Promise.all([getAllOrdersForAdmin(), getAllCustomersForAdmin()]);

  const revenue = orders.reduce((sum, o) => sum + o.totals.total.amount, 0);
  const averageOrderValue = orders.length ? revenue / orders.length : 0;

  const revenueByDay = [...orders]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((order) => ({ label: formatDate(order.createdAt).replace(/, \d{4}$/, ""), value: order.totals.total.amount }));

  const statusCounts = new Map<string, number>();
  for (const order of orders) statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1);
  const ordersByStatus = Array.from(statusCounts.entries()).map(([label, value]) => ({ label, value }));

  const topCustomers = [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);

  return (
    <div>
      <AdminPageHeader title="Analytics" description="Aggregate figures derived from real orders and customers." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard id="revenue" label="Total Revenue" value={`€${revenue.toLocaleString()}`} />
        <StatCard id="aov" label="Average Order Value" value={`€${averageOrderValue.toFixed(2)}`} />
        <StatCard id="orders" label="Total Orders" value={String(orders.length)} />
        <StatCard id="customers" label="Total Customers" value={String(customers.length)} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border border-border bg-luxe-white p-5">
          <h3 className="mb-4 text-sm font-medium tracking-[0.05em] uppercase">Revenue by Order</h3>
          <MiniBarChart data={revenueByDay} formatValue={(v) => `€${v}`} />
        </div>
        <div className="border border-border bg-luxe-white p-5">
          <h3 className="mb-4 text-sm font-medium tracking-[0.05em] uppercase">Orders by Status</h3>
          <MiniBarChart data={ordersByStatus} />
        </div>
      </div>

      <div className="mt-8">
        <h3 className="mb-3 text-sm font-medium tracking-[0.05em] uppercase">Top Customers</h3>
        <DataTable<AdminCustomerRow>
          columns={[
            { header: "Customer", cell: (row) => `${row.firstName} ${row.lastName}` },
            { header: "Orders", cell: (row) => row.ordersCount },
            { header: "Total Spent", cell: (row) => `€${row.totalSpent.toLocaleString()}`, className: "text-right" },
          ]}
          rows={topCustomers}
          getRowKey={(row) => row.id}
        />
      </div>
    </div>
  );
}
