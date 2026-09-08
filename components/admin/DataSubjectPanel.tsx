"use client";

import { useActionState, useState } from "react";
import {
  eraseCustomerDataAction,
  exportCustomerDataAction,
  type DataSubjectActionState,
} from "@/app/admin/(dashboard)/customers/actions";

/**
 * The UI for the two GDPR data-subject rights (PRIV-002).
 *
 * Both work from an email address rather than a row in the customers table, because the
 * obligation is not limited to people who created an account. A newsletter subscriber, a
 * guest who ordered once, someone who only ever sent a contact message — the shop holds
 * data on all of them, and `findDataSubject` looks the subject up across every one of those
 * places. Hanging this off a per-row button would have quietly answered "we hold nothing"
 * for exactly the people least able to check.
 *
 * Rendered only for roles with `admin:settings`. The actions re-check server-side, which is
 * where the real gate is — hiding a control has never been the protection.
 */

const INPUT = "h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black";
const LABEL = "mb-1.5 block text-xs font-medium tracking-[0.05em] text-luxe-gray-dark uppercase";
const BUTTON = "h-10 border border-luxe-black px-5 text-xs font-medium tracking-[0.05em] uppercase disabled:opacity-50";
const DANGER_BUTTON =
  "h-10 border border-destructive px-5 text-xs font-medium tracking-[0.05em] text-destructive uppercase transition-colors hover:bg-destructive hover:text-luxe-white disabled:opacity-50";

function CountList({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) return <p className="text-xs text-luxe-gray-dark">None.</p>;
  return (
    <ul className="space-y-0.5 text-xs">
      {entries.map(([name, count]) => (
        <li key={name}>
          {count} × {name}
        </li>
      ))}
    </ul>
  );
}

export function ExportCustomerDataForm() {
  const [email, setEmail] = useState("");
  const [state, action, pending] = useActionState(
    async (_prev: DataSubjectActionState, formData: FormData) =>
      exportCustomerDataAction(String(formData.get("email") ?? "")),
    {}
  );

  /**
   * An explicit second click rather than an automatic save. The payload is every piece of
   * personal data the shop holds on one person, and a file that lands in Downloads on its
   * own is a copy nobody consciously made.
   */
  function save(payload: string) {
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `personal-data-${email.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <form action={action} className="border border-border bg-luxe-white p-6">
      <h3 className="text-sm font-medium tracking-[0.05em] uppercase">Export someone&apos;s data</h3>
      <p className="mt-1 text-xs text-luxe-gray-dark">
        Everything held for one email address, as JSON — account, addresses, orders, returns, reviews, wishlist,
        newsletter and messages. Article 15. Works for guests and subscribers who never had an account.
      </p>

      <div className="mt-5">
        <label htmlFor="ds-export-email" className={LABEL}>
          Email address
        </label>
        <input
          id="ds-export-email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={INPUT}
          autoComplete="off"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={BUTTON}>
          {pending ? "Gathering…" : "Export"}
        </button>
        {state.payload ? (
          <button type="button" onClick={() => save(state.payload ?? "")} className={BUTTON}>
            Download JSON ({(state.payload.length / 1024).toFixed(1)} KB)
          </button>
        ) : null}
        <p aria-live="polite" className="text-xs text-destructive">
          {state.error}
        </p>
      </div>

      {state.payload ? (
        <p className="mt-3 text-xs text-luxe-gray-dark">
          Ready. The export is recorded against your account in Activity.
        </p>
      ) : null}
    </form>
  );
}

export function EraseCustomerDataForm() {
  const [email, setEmail] = useState("");
  const [state, action, pending] = useActionState(
    async (_prev: DataSubjectActionState, formData: FormData) =>
      eraseCustomerDataAction(String(formData.get("email") ?? ""), String(formData.get("confirmation") ?? "")),
    {}
  );

  return (
    <form action={action} className="border border-destructive bg-luxe-white p-6">
      <h3 className="text-sm font-medium tracking-[0.05em] uppercase">Erase someone&apos;s data</h3>
      <p className="mt-1 text-xs text-luxe-gray-dark">
        Article 17, and irreversible. Orders are kept but stripped of identity — Greek tax law requires the
        transaction record, and Article 17(3)(b) allows for exactly that. Everything with no such obligation
        behind it is deleted outright.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ds-erase-email" className={LABEL}>
            Email address
          </label>
          <input
            id="ds-erase-email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={INPUT}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="ds-erase-confirm" className={LABEL}>
            Type it again to confirm
          </label>
          <input
            id="ds-erase-confirm"
            name="confirmation"
            type="email"
            required
            className={INPUT}
            autoComplete="off"
            placeholder={email || "the same address"}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button type="submit" disabled={pending} className={DANGER_BUTTON}>
          {pending ? "Erasing…" : "Erase permanently"}
        </button>
        <p aria-live="polite" className="text-xs text-destructive">
          {state.error}
        </p>
      </div>

      {state.summary ? (
        <div aria-live="polite" className="mt-5 border border-border p-4">
          {/*
            No email in this heading. It would have to come from the live input, which the
            operator can edit after the fact — relabelling a finished erasure with someone
            else's address. The audit entry holds the masked address, and that is the copy
            that has to be right.
          */}
          <p className="text-xs font-medium tracking-[0.05em] uppercase">Erasure complete</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className={LABEL}>Deleted</p>
              <CountList counts={state.summary.deleted} />
            </div>
            <div>
              <p className={LABEL}>Kept, anonymised</p>
              <CountList counts={state.summary.anonymised} />
            </div>
            <div>
              <p className={LABEL}>Retained</p>
              {state.summary.retained.length > 0 ? (
                <ul className="space-y-0.5 text-xs">
                  {state.summary.retained.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-luxe-gray-dark">Nothing.</p>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-luxe-gray-dark">
            Recorded in Activity, which is what you show if the request is ever queried.
          </p>
        </div>
      ) : null}
    </form>
  );
}
