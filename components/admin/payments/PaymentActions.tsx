"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  cancelPaymentAction,
  confirmManualPaymentAction,
  refreshPaymentStatusAction,
  refundPaymentAction,
} from "@/app/admin/(dashboard)/payments/actions";
import { useToast } from "@/components/providers/ToastProvider";
import { isOutstanding } from "@/lib/payments/status";
import type { PaymentStatus } from "@/lib/payments/types";
import { cn } from "@/lib/utils";

const inputClass = "h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black";

/**
 * The admin's payment actions.
 *
 * Which buttons exist is decided by the METHOD's declared capabilities and the
 * payment's current status, not by the vendor — "Mark as received" appears for any
 * method that settles manually, whether that's cash, a bank transfer or a future
 * offline method nobody has written yet. The server re-checks every one of these
 * conditions; hiding a button is UX, never a guard.
 */
export function PaymentActions({
  paymentId,
  status,
  currencyCode,
  remainingRefundable,
  supportsManualConfirmation,
  supportsRefunds,
  supportsPartialRefunds,
  supportsProviderLookup,
  canManage,
  canRefund,
}: {
  paymentId: string;
  status: PaymentStatus;
  currencyCode: string;
  remainingRefundable: number;
  supportsManualConfirmation: boolean;
  supportsRefunds: boolean;
  supportsPartialRefunds: boolean;
  supportsProviderLookup: boolean;
  canManage: boolean;
  canRefund: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [refundAmount, setRefundAmount] = useState(remainingRefundable.toFixed(2));
  const [refundReason, setRefundReason] = useState("");
  const { toast } = useToast();

  const run = (action: () => Promise<{ error?: string; success?: string }>) => {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast({ title: "Action failed", description: result.error, tone: "error" });
        return;
      }
      toast({ title: result.success ?? "Done" });
    });
  };

  const canConfirmManually = supportsManualConfirmation && isOutstanding(status) && status !== "processing";
  const canCancel = isOutstanding(status);
  const canIssueRefund = supportsRefunds && remainingRefundable > 0 && (status === "paid" || status === "partially_refunded");

  const nothingAvailable = !canConfirmManually && !canCancel && !canIssueRefund && !supportsProviderLookup;
  if (nothingAvailable) return null;

  return (
    <section className="border border-border bg-luxe-white">
      <h3 className="border-b border-border p-4 text-sm font-medium tracking-[0.05em] uppercase">Actions</h3>
      <div className="space-y-6 p-4">
        {supportsProviderLookup ? (
          <div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => refreshPaymentStatusAction(paymentId))}
              className="flex h-10 items-center gap-2 border border-border px-4 text-xs font-medium tracking-[0.08em] uppercase transition-colors hover:border-luxe-black disabled:opacity-50"
            >
              {isPending ? <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} /> : null}
              Refresh status from provider
            </button>
            <p className="mt-1.5 text-xs text-luxe-gray-dark">
              Asks the provider what this payment&apos;s state actually is and applies the answer. It can never set a
              status the provider doesn&apos;t report.
            </p>
          </div>
        ) : null}

        {canConfirmManually ? (
          <div className="border-t border-border pt-5">
            <p className="text-eyebrow mb-2">Mark as received</p>
            <p className="mb-3 text-xs text-luxe-gray-dark">
              Records that the shop has this money. This is an accounting statement — only use it once you have
              confirmed the cash was collected or the transfer landed.
            </p>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note (e.g. bank reference, courier name)"
              className={cn(inputClass, "mb-3")}
              disabled={!canManage}
            />
            <button
              type="button"
              disabled={isPending || !canManage}
              onClick={() => run(() => confirmManualPaymentAction(paymentId, note))}
              className="flex h-10 items-center justify-center bg-luxe-black px-5 text-xs font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Mark as received
            </button>
            {!canManage ? (
              <p className="mt-2 text-xs text-luxe-gray-dark">Your role can view payments but not confirm them.</p>
            ) : null}
          </div>
        ) : null}

        {canIssueRefund ? (
          <div className="border-t border-border pt-5">
            <p className="text-eyebrow mb-2">Refund</p>
            <p className="mb-3 text-xs text-luxe-gray-dark">
              {remainingRefundable.toFixed(2)} {currencyCode} available to refund.
              {supportsPartialRefunds ? " Partial refunds are supported." : " This method only supports full refunds."}
            </p>
            <div className="flex flex-wrap gap-3">
              <input
                type="number"
                step="0.01"
                min="0"
                max={remainingRefundable}
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
                disabled={!canRefund || !supportsPartialRefunds}
                className={cn(inputClass, "w-32")}
              />
              <input
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                placeholder="Reason (optional)"
                disabled={!canRefund}
                className={cn(inputClass, "min-w-48 flex-1")}
              />
            </div>
            <button
              type="button"
              disabled={isPending || !canRefund}
              onClick={() => run(() => refundPaymentAction(paymentId, Number(refundAmount), refundReason))}
              className="mt-3 flex h-10 items-center justify-center border border-destructive px-5 text-xs font-medium tracking-[0.08em] text-destructive uppercase transition-colors hover:bg-destructive hover:text-luxe-white disabled:opacity-50"
            >
              Issue refund
            </button>
            {!canRefund ? (
              <p className="mt-2 text-xs text-luxe-gray-dark">Your role can&apos;t issue refunds.</p>
            ) : null}
          </div>
        ) : null}

        {canCancel ? (
          <div className="border-t border-border pt-5">
            <p className="text-eyebrow mb-2">Cancel</p>
            <p className="mb-3 text-xs text-luxe-gray-dark">
              Ends this payment attempt. The order itself is untouched — cancel it separately if that&apos;s what you
              mean.
            </p>
            <button
              type="button"
              disabled={isPending || !canManage}
              onClick={() => run(() => cancelPaymentAction(paymentId))}
              className="flex h-10 items-center justify-center border border-border px-5 text-xs font-medium tracking-[0.08em] uppercase transition-colors hover:border-luxe-black disabled:opacity-50"
            >
              Cancel payment
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
