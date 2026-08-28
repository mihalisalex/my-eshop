"use client";

import { useCallback, useEffect, useState } from "react";
import { PackageOpen } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { ReturnRequestDialog } from "@/components/account/ReturnRequestDialog";
import { getCommerceProvider } from "@/lib/commerce";
import { formatDate, formatMoney } from "@/lib/format";
import type { Order, Return } from "@/lib/commerce/types";
import { useTranslations } from "next-intl";

const RETURN_STATUS_LABEL: Record<Return["status"], string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  received: "Received",
  refunded: "Refunded",
};

export default function AccountReturnsPage() {
  const t = useTranslations("Account");
  const { customer } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [returns, setReturns] = useState<Return[] | null>(null);

  const loadReturns = useCallback(async () => {
    const res = await fetch("/api/customer/returns");
    if (res.ok) {
      const body = await res.json();
      setReturns(body.returns);
    }
  }, []);

  useEffect(() => {
    if (!customer) return;
    const commerce = getCommerceProvider();
    commerce.customer.getOrders(customer.id).then(setOrders);
    // Fetch-on-mount — eventually setState via a promise chain, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReturns();
  }, [customer, loadReturns]);

  return (
    <div>
      <h1 className="font-heading text-3xl">{t("returns")}</h1>
      <p className="mt-2 text-sm text-luxe-gray-dark">Start a return on any past order, or check the status of one you&apos;ve already requested.</p>

      {returns && returns.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark">{t("yourRequests")}</h2>
          <div className="mt-3 divide-y divide-border border-y border-border">
            {returns.map((ret) => (
              <div key={ret.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="text-sm font-medium">Order {ret.orderId.slice(-8).toUpperCase()}</p>
                  <p className="text-xs text-luxe-gray-dark">
                    {ret.items.length} item{ret.items.length === 1 ? "" : "s"} &middot; Requested {formatDate(ret.createdAt)}
                  </p>
                </div>
                <span className="text-xs font-medium tracking-[0.05em] uppercase">{RETURN_STATUS_LABEL[ret.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark">{t("eligibleOrders")}</h2>
        {orders === null ? (
          <p className="mt-3 text-sm text-luxe-gray-dark">Loading...</p>
        ) : orders.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-3 border border-border py-16 text-center">
            <PackageOpen className="size-10 text-luxe-gray-dark" strokeWidth={1} />
            <p className="text-sm text-luxe-gray-dark">No orders eligible for return.</p>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-border border-y border-border">
            {orders.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-5">
                <div>
                  <p className="text-sm font-medium">Order {order.id.slice(-8).toUpperCase()}</p>
                  <p className="text-xs text-luxe-gray-dark">
                    Placed {formatDate(order.createdAt)} &middot; {formatMoney(order.totals.total)}
                  </p>
                </div>
                <ReturnRequestDialog order={order} onCreated={loadReturns} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
