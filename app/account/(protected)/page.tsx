"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, MapPin, Heart, User } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getCommerceProvider } from "@/lib/commerce";
import { getLoyaltyTier, getNextLoyaltyTier } from "@/lib/loyalty";
import { formatMoney } from "@/lib/format";
import type { Order } from "@/lib/commerce/types";
import { useTranslations } from "next-intl";

const QUICK_LINKS = [
  { href: "/account/orders", labelKey: "orders", icon: Package },
  { href: "/account/addresses", labelKey: "addresses", icon: MapPin },
  { href: "/wishlist", labelKey: "wishlist", icon: Heart },
  { href: "/account/profile", labelKey: "profile", icon: User },
];

export default function AccountOverviewPage() {
  const t = useTranslations("Account");
  const { customer } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    if (!customer) return;
    const commerce = getCommerceProvider();
    commerce.customer.getOrders(customer.id).then(setOrders);
  }, [customer]);

  if (!customer) return null;

  const lifetimeSpend = (orders ?? [])
    .filter((order) => order.status !== "cancelled" && order.status !== "refunded")
    .reduce((sum, order) => sum + order.totals.total.amount, 0);
  const tier = getLoyaltyTier(lifetimeSpend);
  const nextTier = getNextLoyaltyTier(lifetimeSpend);
  const currencyCode = orders?.[0]?.totals.total.currencyCode ?? "EUR";

  return (
    <div>
      <h1 className="font-heading text-3xl">Welcome back, {customer.firstName}</h1>
      <p className="mt-2 text-sm text-luxe-gray-dark">
        {orders === null ? "Loading your account..." : `${orders.length} order${orders.length === 1 ? "" : "s"} placed`}
      </p>

      {orders !== null ? (
        <div className="mt-8 border border-border bg-luxe-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark">{t("loyaltyStatus")}</p>
              <p className="mt-1 font-heading text-2xl">{tier.label}</p>
            </div>
            <p className="text-sm text-luxe-gray-dark">
              Lifetime spend: <span className="text-luxe-black">{formatMoney({ amount: lifetimeSpend, currencyCode })}</span>
            </p>
          </div>
          {nextTier ? (
            <p className="mt-3 text-xs text-luxe-gray-dark">
              {formatMoney({ amount: nextTier.threshold - lifetimeSpend, currencyCode })} away from {nextTier.label}
            </p>
          ) : (
            <p className="mt-3 text-xs text-luxe-gray-dark">You&apos;ve reached our highest tier.</p>
          )}
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-luxe-gray-dark">
            {tier.perks.map((perk) => (
              <li key={perk}>&bull; {perk}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col items-center gap-2 border border-border py-6 text-center transition-colors hover:border-luxe-black"
          >
            <link.icon className="size-5" strokeWidth={1.5} />
            <span className="text-sm">{t(link.labelKey)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
