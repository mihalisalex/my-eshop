"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getCommerceProvider } from "@/lib/commerce";
import { formatDate, formatMoney } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/constants/order-status";
import type { Order } from "@/lib/commerce/types";
import { useTranslations } from "next-intl";

export default function AccountOrdersPage() {
  const t = useTranslations("Account");
  const { customer } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    if (!customer) return;
    const commerce = getCommerceProvider();
    commerce.customer.getOrders(customer.id).then(setOrders);
  }, [customer]);

  return (
    <div>
      <h1 className="font-heading text-3xl">{t("orders")}</h1>

      {orders === null ? (
        <p className="mt-8 text-sm text-luxe-gray-dark">Loading...</p>
      ) : orders.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 border border-border py-16 text-center">
          <Package className="size-10 text-luxe-gray-dark" strokeWidth={1} />
          <p className="text-sm text-luxe-gray-dark">You haven&apos;t placed any orders yet.</p>
        </div>
      ) : (
        <div className="mt-8 divide-y divide-border border-y border-border">
          {orders.map((order) => (
            <div key={order.id} className="py-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Order {order.id}</p>
                  <p className="text-xs text-luxe-gray-dark">
                    Placed {formatDate(order.createdAt)} &middot; {ORDER_STATUS_LABEL[order.status]}
                  </p>
                </div>
                <p className="text-sm font-medium">{formatMoney(order.totals.total)}</p>
              </div>
              {order.trackingNumber ? (
                <p className="mt-2 text-xs text-luxe-gray-dark">
                  {order.carrier ?? "Tracking"}: {order.trackingNumber}
                  {order.trackingUrl ? (
                    <>
                      {" "}
                      &middot;{" "}
                      <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="underline hover:text-luxe-black">
                        {t("trackPackage")}
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-3">
                {order.lineItems.map((item) => (
                  <div key={item.id} className="relative size-14 shrink-0 overflow-hidden bg-luxe-gray-light">
                    <Image src={item.image.src} alt={item.image.alt} fill sizes="56px" className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
