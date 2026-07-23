"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";

interface ActiveToggleProps {
  id: string;
  defaultActive: boolean;
  onToggle: (id: string, active: boolean) => Promise<void>;
}

/** Shared by Discounts and Gift Cards — replaces the old DiscountActiveToggle's local-useState-only version with a real Server Action call, optimistic UI kept for immediate feedback while the transition is pending. */
export function ActiveToggle({ id, defaultActive, onToggle }: ActiveToggleProps) {
  const [active, setActive] = useState(defaultActive);
  const [isPending, startTransition] = useTransition();

  const handleChange = (next: boolean) => {
    setActive(next);
    startTransition(async () => {
      await onToggle(id, next);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Switch checked={active} onCheckedChange={handleChange} disabled={isPending} />
      <span className="text-xs text-luxe-gray-dark">{active ? "Active" : "Inactive"}</span>
    </div>
  );
}
