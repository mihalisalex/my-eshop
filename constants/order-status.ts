import type { Order } from "@/lib/commerce/types";

/** Shared across the customer-facing orders page and the admin orders page — previously each hand-rolled its own partial (2-status vs 5-status) mapping. */
export const ORDER_STATUS_LABEL: Record<Order["status"], string> = {
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const ORDER_STATUS_OPTIONS: Order["status"][] = [
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];
