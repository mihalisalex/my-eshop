"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { ConciergeRequest } from "@/services/concierge";

const STATUS_OPTIONS: ConciergeRequest["status"][] = ["open", "responded", "closed"];

const STATUS_STYLES: Record<ConciergeRequest["status"], string> = {
  open: "text-blue-700",
  responded: "text-green-700",
  closed: "text-luxe-gray-dark",
};

interface ConciergeStatusSelectProps {
  requestId: string;
  defaultStatus: ConciergeRequest["status"];
  onChange: (id: string, status: ConciergeRequest["status"]) => Promise<void>;
}

export function ConciergeStatusSelect({ requestId, defaultStatus, onChange }: ConciergeStatusSelectProps) {
  const [status, setStatus] = useState(defaultStatus);
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as ConciergeRequest["status"];
        setStatus(next);
        startTransition(async () => {
          await onChange(requestId, next);
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
