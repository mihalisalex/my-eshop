"use server";

import { revalidatePath } from "next/cache";
import { capabilityDenied } from "@/lib/admin-session";
import { recordAdminAction } from "@/services/audit-log";
import { eraseDataSubject, exportDataSubject, findDataSubject } from "@/services/data-subject";

/**
 * The two GDPR data-subject rights, as admin actions (PRIV-002).
 *
 * Behind `admin:settings` rather than a customer-management capability: erasure is
 * irreversible and legally consequential, and it should sit with whoever owns the shop's
 * obligations, not with whoever happens to be editing the catalogue.
 *
 * Both record to the admin audit log. "We honoured this request on this date" is precisely
 * the kind of thing you need to be able to show later, and it is the reason `OBS-003` widened
 * that log before this was written.
 */

export interface DataSubjectActionState {
  error?: string;
  /** JSON, ready for the browser to save. Only set by the export action. */
  payload?: string;
  /** A human summary of an erasure, including what was deliberately kept. */
  summary?: { deleted: Record<string, number>; anonymised: Record<string, number>; retained: string[] };
}

export async function exportCustomerDataAction(email: string): Promise<DataSubjectActionState> {
  const denied = await capabilityDenied("admin:settings");
  if (denied) return { error: denied };

  const subject = await findDataSubject(email);
  if (!subject) return { error: "No data is held for that email address." };

  const dump = await exportDataSubject(subject);

  await recordAdminAction({
    action: "dataSubject.exported",
    targetType: "customer",
    targetId: subject.customerId ?? subject.email,
    summary: `Exported all data held for ${maskEmail(subject.email)} (GDPR Art. 15)`,
    // The email is masked in the trail too: a log that records the address in full is a second
    // copy of the thing the person may be about to ask you to delete.
    metadata: { hasAccount: subject.customerId !== null, orders: (dump.orders as unknown[]).length },
  });

  return { payload: JSON.stringify(dump, null, 2) };
}

export async function eraseCustomerDataAction(email: string, confirmation: string): Promise<DataSubjectActionState> {
  const denied = await capabilityDenied("admin:settings");
  if (denied) return { error: denied };

  /**
   * Typed confirmation, not a checkbox.
   *
   * This is irreversible and it runs against live customer data. The cost of a mis-click is a
   * person's records gone with no undo, so the action asks for the email to be typed a second
   * time and compares it — the same protection a repository host asks for before deleting a
   * repo, for the same reason.
   */
  if (confirmation.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return { error: "Type the email address again to confirm. Erasure cannot be undone." };
  }

  const subject = await findDataSubject(email);
  if (!subject) return { error: "No data is held for that email address." };

  const summary = await eraseDataSubject(subject);

  await recordAdminAction({
    action: "dataSubject.erased",
    targetType: "customer",
    targetId: subject.customerId ?? subject.email,
    summary: `Erased personal data for ${maskEmail(subject.email)} (GDPR Art. 17); ${summary.anonymised.orders ?? 0} order(s) anonymised and kept`,
    metadata: { deleted: summary.deleted, anonymised: summary.anonymised },
  });

  revalidatePath("/admin/customers");
  revalidatePath("/admin/activity");
  return { summary };
}

/** `m***@gmail.com` — enough to recognise the record, not enough to be a copy of it. */
function maskEmail(email: string): string {
  return email.replace(/^(.).*(@.*)$/, "$1***$2");
}
