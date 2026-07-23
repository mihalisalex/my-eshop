"use client";

import { useState, useTransition } from "react";
import { ORDER_STATUS_LABEL, ORDER_STATUS_OPTIONS } from "@/constants/order-status";
import type { Order } from "@/lib/commerce/types";

interface OrderStatusSelectProps {
  orderId: string;
  defaultStatus: Order["status"];
  onChange: (orderId: string, status: Order["status"]) => Promise<void>;
}

/** Same <select> + useTransition pattern as RoleSelect/ReturnStatusSelect, but persisting for real via a Server Action instead of local state only. */
export function OrderStatusSelect({ orderId, defaultStatus, onChange }: OrderStatusSelectProps) {
  const [status, setStatus] = useState(defaultStatus);
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as Order["status"];
        setStatus(next);
        startTransition(async () => {
          await onChange(orderId, next);
        });
      }}
      className="h-8 border border-border bg-transparent px-2 text-xs capitalize outline-none focus:border-luxe-black disabled:opacity-50"
    >
      {ORDER_STATUS_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {ORDER_STATUS_LABEL[option]}
        </option>
      ))}
    </select>
  );
}
