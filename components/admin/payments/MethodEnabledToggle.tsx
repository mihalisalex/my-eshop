"use client";

import { useState, useTransition } from "react";
import { setMethodEnabledAction } from "@/app/admin/(dashboard)/settings/payments/actions";
import { useToast } from "@/components/providers/ToastProvider";
import { cn } from "@/lib/utils";

/**
 * Optimistic switch backed by a real Server Action. Reverts on refusal — a
 * permission error must leave the UI showing the truth, not the change the admin
 * attempted.
 */
export function MethodEnabledToggle({
  methodId,
  enabled,
  hint,
}: {
  methodId: string;
  enabled: boolean;
  hint?: string;
}) {
  const [isOn, setIsOn] = useState(enabled);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const onToggle = () => {
    const next = !isOn;
    setIsOn(next);
    startTransition(async () => {
      const result = await setMethodEnabledAction(methodId, next);
      if (result.error) {
        setIsOn(!next);
        toast({ title: "Couldn't update", description: result.error, tone: "error" });
        return;
      }
      toast({ title: result.success ?? "Updated" });
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={`${isOn ? "Disable" : "Enable"} this payment method`}
        disabled={isPending}
        onClick={onToggle}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:opacity-50",
          isOn ? "border-luxe-black bg-luxe-black" : "border-border bg-luxe-gray-light"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3.5 rounded-full transition-all",
            isOn ? "left-[18px] bg-luxe-white" : "left-0.5 bg-luxe-gray-dark"
          )}
        />
      </button>
      {isOn && hint ? <span className="text-[10px] text-luxe-gray-dark">{hint}</span> : null}
    </div>
  );
}
