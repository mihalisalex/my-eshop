"use client";
import { useTranslations } from "next-intl";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/ToastProvider";
import { formatMoney } from "@/lib/format";
import type { Order, ReturnItem } from "@/lib/commerce/types";

interface ReturnRequestDialogProps {
  order: Order;
  onCreated: () => void;
}

export function ReturnRequestDialog({ order, onCreated }: ReturnRequestDialogProps) {
  const t = useTranslations("Returns");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggle(lineItemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lineItemId)) next.delete(lineItemId);
      else next.add(lineItemId);
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) {
      toast({ title: t("selectAtLeastOne"), tone: "error" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: t("addReason"), tone: "error" });
      return;
    }

    const items: ReturnItem[] = order.lineItems
      .filter((li) => selected.has(li.id))
      .map((li) => ({ productId: li.productId, name: li.name, color: li.color, size: li.size, quantity: li.quantity }));

    setSubmitting(true);
    try {
      const res = await fetch("/api/customer/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, items, reason: reason.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Couldn't submit your return request.");
      }
      toast({ title: t("returnRequested"), description: t("reviewEmailNote"), tone: "success" });
      setOpen(false);
      setSelected(new Set());
      setReason("");
      onCreated();
    } catch (error) {
      toast({ title: t("somethingWrong"), description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="h-10 rounded-none border-border px-4 text-xs font-medium tracking-[0.05em] uppercase" />
        }
      >
        {t("startReturn")}
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-none border-none p-8">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{t("startReturn")}</DialogTitle>
          <DialogDescription>Order {order.id.slice(-8).toUpperCase()} — select the items you&apos;d like to return.</DialogDescription>
        </DialogHeader>

        <div className="mt-4 divide-y divide-border border-y border-border">
          {order.lineItems.map((item) => (
            <label key={item.id} className="flex cursor-pointer items-center justify-between gap-3 py-3 text-sm">
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="size-4 accent-luxe-black"
                />
                <span>
                  {item.name}
                  <span className="block text-xs text-luxe-gray-dark">
                    {item.color} · {item.size} · Qty {item.quantity}
                  </span>
                </span>
              </span>
              <span className="text-xs text-luxe-gray-dark">{formatMoney(item.unitPrice)}</span>
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark">{t("reason")}</label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPlaceholder")} rows={3} />
        </div>

        <DialogFooter className="mt-2">
          <Button onClick={handleSubmit} disabled={submitting} className="rounded-none">
            {submitting ? "Submitting..." : "Submit Return Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
