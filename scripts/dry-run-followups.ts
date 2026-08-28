import "dotenv/config";
import { runAbandonedCartRecovery, runReviewRequestFollowup } from "@/services/email-followups";

/**
 * Shows exactly who the daily follow-up cron would email, without sending anything.
 *
 *   npx tsx --conditions=react-server scripts/dry-run-followups.ts
 *
 * The `--conditions=react-server` flag is required and is not a hack: `server-only`'s
 * package exports map that condition to an empty module, which is precisely how Next
 * itself satisfies the guard. Without it the import throws "This module cannot be
 * imported from a Client Component module" before a line of this script runs.
 *
 * WHY THIS EXISTS. `runAbandonedCartRecovery` has no lower bound on cart age — it
 * considers every cart ever created that still holds active line items and has an email
 * reachable through a customer record or an unfinished checkout. Right now `EMAIL_FROM`
 * is Resend's shared testing sender, so every send to a real customer fails with a 403
 * and the surrounding catch swallows it; the job is accidentally harmless, and because
 * `abandonedCartEmailSentAt` is only written after a successful send, no state is
 * corrupted either. The moment a real sending domain is verified that safety net
 * disappears and the next 08:00 run mails the whole backlog in one go.
 *
 * It calls the real service with `dryRun: true` rather than re-implementing the query,
 * so the list below cannot disagree with what the cron would actually do.
 */
function table(title: string, summary: Awaited<ReturnType<typeof runAbandonedCartRecovery>>): void {
  console.log(`\n${title}`);
  console.log(`  scanned ${summary.scanned}   would send ${summary.sent}   skipped ${summary.skipped}`);
  const rows = summary.wouldSend ?? [];
  const why = summary.skipReasons ?? {};
  const reasonLines = Object.entries(why).sort((a, b) => b[1] - a[1]);
  if (reasonLines.length > 0) {
    for (const [reason, count] of reasonLines) console.log(`    ${String(count).padStart(3)}  ${reason}`);
  }
  if (rows.length === 0) {
    console.log("  — nobody would be emailed —");
    return;
  }
  console.log("");
  for (const row of rows) console.log(`  ${row.to.padEnd(34)} ${row.detail}`);
}

async function main() {
  console.log("DRY RUN — nothing is sent and nothing is written.");

  const [carts, reviews] = await Promise.all([
    runAbandonedCartRecovery({ dryRun: true }),
    runReviewRequestFollowup({ dryRun: true }),
  ]);

  table("Abandoned cart recovery", carts);
  table("Review requests", reviews);

  const total = carts.sent + reviews.sent;
  console.log(
    total === 0
      ? "\nThe next cron run would send nothing."
      : `\nThe next cron run would send ${total} email(s) — the moment a verified sending domain is in place.`
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
