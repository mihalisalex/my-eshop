import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { ListFilterBar } from "@/components/admin/ListFilterBar";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { Pagination } from "@/components/admin/Pagination";
import { formatDate, formatMoney, orderReference } from "@/lib/format";
import { DEFAULT_PAGE_SIZE, parsePage, parseSearch } from "@/lib/pagination";
import { listOrdersForAdmin, ORDER_STATUS_FILTERS } from "@/services/orders";
import { updateOrderStatusAction } from "@/app/admin/(dashboard)/orders/actions";
import type { Order } from "@/lib/commerce/types";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

interface AdminOrdersPageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

const STATUS_OPTIONS = ORDER_STATUS_FILTERS.map((status) => ({
  value: status,
  label: status.charAt(0).toUpperCase() + status.slice(1),
}));

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  const params = await searchParams;
  const search = parseSearch(params.q);
  const status = ORDER_STATUS_FILTERS.includes(params.status as (typeof ORDER_STATUS_FILTERS)[number])
    ? params.status
    : undefined;

  const { rows, total, page, pageCount, pageSize } = await listOrdersForAdmin({
    search,
    status,
    page: parsePage(params.page),
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const isFiltered = Boolean(search || status);

  return (
    <div>
      <AdminPageHeader
        title="Orders"
        description={isFiltered ? `${total} matching ${total === 1 ? "order" : "orders"}.` : `${total} orders.`}
      />

      <ListFilterBar
        action="/admin/orders"
        searchValue={search}
        searchPlaceholder="Search order number, email, name or tracking"
        selects={[{ name: "status", label: "All statuses", value: status ?? "", options: STATUS_OPTIONS }]}
      />

      {total === 0 ? (
        <p className="border border-border bg-luxe-white p-8 text-center text-sm text-luxe-gray-dark">
          {isFiltered ? "No orders match those filters." : "No orders yet."}
        </p>
      ) : (
        <>
          <DataTable<Order>
            columns={[
              {
                header: "Order",
                cell: (row) => (
                  <Link href={`/admin/orders/${row.id}`} className="font-mono text-xs hover:underline">
                    #{orderReference(row.id)}
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
            rows={rows}
            getRowKey={(row) => row.id}
          />

          <Pagination
            basePath="/admin/orders"
            params={{ q: search, status }}
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            label="orders"
          />
        </>
      )}
    </div>
  );
}
