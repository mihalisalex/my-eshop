"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { Return } from "@/lib/commerce/types";

const STATUS_OPTIONS: Return["status"][] = ["requested", "approved", "rejected", "received", "refunded"];

const STATUS_STYLES: Record<Return["status"], string> = {
  requested: "text-luxe-gray-dark",
  approved: "text-blue-700",
  rejected: "text-destructive",
  received: "text-amber-700",
  refunded: "text-green-700",
};

interface ReturnStatusSelectProps {
  returnId: string;
  defaultStatus: Return["status"];
  onChange: (returnId: string, status: Return["status"]) => Promise<void>;
}

/** Same <select> + useTransition pattern as OrderStatusSelect, persisting for real via a Server Action. */
export function ReturnStatusSelect({ returnId, defaultStatus, onChange }: ReturnStatusSelectProps) {
  const [status, setStatus] = useState(defaultStatus);
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as Return["status"];
        setStatus(next);
        startTransition(async () => {
          await onChange(returnId, next);
        });
      }}
      className={cn("h-8 border border-border bg-transparent px-2 text-xs capitalize outline-none disabled:opacity-50", STATUS_STYLES[status])}
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option} value={option} className="text-luxe-black">
          {option}
        </option>
      ))}
    </select>
  );
}
