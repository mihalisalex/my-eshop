"use client";

import { useEffect, useMemo, useRef } from "react";
import { getCommerceProvider } from "@/lib/commerce";

/**
 * Fires the `purchase` analytics event for a payment that settled through a
 * redirect, where the shopper left the site before it could be attributed.
 *
 * `CheckoutProvider.placeOrder` deliberately skips the event for redirect flows —
 * counting a shopper who bounced off a payment page as revenue is exactly the kind
 * of quiet inaccuracy that makes analytics untrustworthy. This fires only once the
 * server has verified the payment as settled.
 *
 * The sessionStorage guard covers the ordinary case of a shopper refreshing or
 * revisiting the confirmation URL; it is per-tab, so it isn't a perfect
 * deduplication — a real analytics platform dedupes server-side on the order id,
 * which is why the id is included in the payload.
 */
export function PurchaseAnalytics({ orderId, total }: { orderId: string; total: number }) {
  const commerce = useMemo(() => getCommerceProvider(), []);
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;

    const key = `alexandris_purchase_tracked_${orderId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    commerce.analytics.track({ name: "purchase", properties: { orderId, total } });
  }, [commerce, orderId, total]);

  return null;
}
