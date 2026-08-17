import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "@/lib/payments/status";
import type { PaymentStatus } from "@/lib/payments/types";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<"positive" | "pending" | "negative" | "neutral", string> = {
  positive: "border-green-700/30 bg-green-700/10 text-green-800",
  pending: "border-amber-600/30 bg-amber-500/10 text-amber-800",
  negative: "border-destructive/30 bg-destructive/10 text-destructive",
  neutral: "border-border bg-luxe-gray-light text-luxe-gray-dark",
};

/** Reads its tone from lib/payments/status.ts, so a new status can't be added without one. */
export function PaymentStatusPill({ status, className }: { status: PaymentStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 text-[11px] font-medium tracking-[0.03em] whitespace-nowrap uppercase",
        TONE_CLASS[PAYMENT_STATUS_TONE[status]],
        className
      )}
    >
      {PAYMENT_STATUS_LABEL[status]}
    </span>
  );
}

/** Connection status for a provider card, mirroring ConfigurationTestResult's vocabulary. */
export function ConnectionStatusPill({
  status,
  className,
}: {
  status: "connected" | "auth_failed" | "not_configured" | "unavailable" | "not_implemented" | "untested";
  className?: string;
}) {
  const map = {
    connected: { label: "Connected", tone: "positive" as const },
    auth_failed: { label: "Authentication failed", tone: "negative" as const },
    not_configured: { label: "Not configured", tone: "neutral" as const },
    unavailable: { label: "Provider unavailable", tone: "negative" as const },
    // Distinct from "not configured" on purpose: the credentials may be complete and
    // the integration still doesn't exist. Collapsing the two would let a fully
    // filled-in Piraeus form read as ready.
    not_implemented: { label: "Integration pending", tone: "pending" as const },
    untested: { label: "Not tested", tone: "neutral" as const },
  }[status];

  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 text-[11px] font-medium tracking-[0.03em] whitespace-nowrap uppercase",
        TONE_CLASS[map.tone],
        className
      )}
    >
      {map.label}
    </span>
  );
}
