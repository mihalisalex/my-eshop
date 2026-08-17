import { PAYMENT_EVENT_LABEL } from "@/lib/payments/status";
import type { PaymentTimelineEntry } from "@/lib/payments/mappers";
import type { PaymentEventType } from "@/lib/payments/types";
import { formatMoney } from "@/lib/format";

const ACTOR_LABEL: Record<string, string> = {
  customer: "Customer",
  admin: "Administrator",
  provider: "Provider",
  system: "System",
};

/**
 * The append-only audit trail (§26), rendered oldest-first.
 *
 * This is the single most useful screen when a real payment goes wrong months
 * later: who did what, what the provider said, and in which order — including
 * webhook deliveries and provider errors that never changed the status.
 */
export function PaymentTimeline({ entries }: { entries: PaymentTimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="p-4 text-sm text-luxe-gray-dark">No events recorded yet.</p>;
  }

  return (
    <ol className="divide-y divide-border">
      {entries.map((entry) => {
        const timestamp = new Date(entry.createdAt);
        return (
          <li key={entry.id} className="flex gap-4 p-4 text-sm">
            <time
              dateTime={entry.createdAt}
              className="w-28 shrink-0 text-xs text-luxe-gray-dark tabular-nums"
              title={timestamp.toLocaleString()}
            >
              {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              <span className="block">{timestamp.toLocaleDateString()}</span>
            </time>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {PAYMENT_EVENT_LABEL[entry.eventType as PaymentEventType] ?? entry.eventType}
                {entry.amount ? <span className="ml-2 font-normal">{formatMoney(entry.amount)}</span> : null}
              </p>
              {entry.message ? <p className="mt-0.5 text-luxe-gray-dark">{entry.message}</p> : null}
              <p className="mt-1 text-xs text-luxe-gray-dark">
                {ACTOR_LABEL[entry.actorType] ?? entry.actorType}
                {entry.status ? ` · status: ${entry.status}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
