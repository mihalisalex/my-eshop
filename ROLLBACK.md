# Rollback

What to do when a deploy goes wrong. Written to be followed at 3am by someone who did not
write the change — including you, six months from now.

The audit flagged this as the last real gap in deployment practice: the migrations here are
additive and safe, but "what do we do when it isn't" was never written down, and that is not
a thing to work out while the shop is down.

---

## First: decide which kind of problem this is

They have different answers, and picking the wrong one makes things worse.

| Symptom | Kind | Go to |
|---|---|---|
| Site errors or looks broken after a deploy | **Code** | [Roll back the code](#1-roll-back-the-code) |
| Site fine, but one feature misbehaves | **Code** | [Roll back the code](#1-roll-back-the-code) |
| Errors mentioning a column or table | **Schema** | [Schema problems](#2-schema-problems) |
| Site down, nothing deployed recently | **Infra** | [Neither — it is not your code](#3-when-it-is-not-your-code) |
| Wrong data (prices, stock, orders) | **Data** | [Data problems](#4-data-problems) |

**The single most important rule:** rolling back code is cheap, safe and instant. Rolling back
a database is neither. Never reach for a schema change to fix something a code rollback fixes.

---

## 1. Roll back the code

This is the answer to almost every bad deploy, and it takes under a minute.

**Vercel Dashboard → the project → Deployments →** find the last deployment that was good →
**⋯ → Promote to Production**.

That is it. It re-points production at an existing, already-built deployment. Nothing
rebuilds, so there is no chance of the rollback itself failing to compile.

Then, and only then, fix forward in the repository:

```bash
git revert <bad-commit-sha>
git push origin main
```

**Why revert rather than reset:** `main` is deployed straight from, with no PRs. A force-push
rewrites history the deployment platform has already built from, and anyone else's clone
disagrees with the remote afterwards. A revert is a new commit that undoes the old one —
honest, additive, and it leaves the mistake visible in the log where it belongs.

### The one thing to check before promoting

If the bad deploy also ran a migration, promoting old code against a new schema can fail in a
second way. Read [Schema problems](#2-schema-problems) first. Additive migrations are safe
here — old code simply ignores a new column — which is why every migration in this repo so
far has been additive.

---

## 2. Schema problems

Migrations run against Neon through `DIRECT_URL`, not the pooled endpoint.

### Additive migrations are already safe

Every migration in `prisma/migrations/` to date only **adds** — a nullable column, a new
table, an index. Old code does not select the new column, so promoting a previous deployment
works with no database action at all.

Verify a migration is additive before trusting that: open its `migration.sql` and confirm it
contains no `DROP`, no `ALTER COLUMN … SET NOT NULL`, and no `RENAME`.

### If a migration must be undone

Prisma has no `migrate down`. Write a new forward migration that reverses it — do not edit or
delete the original, because the `_prisma_migrations` table records that it ran, and removing
it desynchronises every environment.

```bash
# 1. Confirm what production actually has applied.
npx prisma migrate status

# 2. Create the reversing migration WITHOUT running it.
npx prisma migrate dev --create-only --name revert_<original_name>

# 3. Write the reversing SQL by hand, then dry-run it against production
#    inside a transaction that is rolled back — see below.
```

### Always dry-run against production first

This is the practice used for both migrations applied so far, and it is the reason neither
caused an incident. Wrap the statements in a transaction and roll it back: you learn whether
the SQL is valid against the real schema and real data, and you change nothing.

```sql
BEGIN;
-- the migration's statements here
-- inspect: SELECT what you expect to have changed
ROLLBACK;   -- <-- not COMMIT
```

Only after that comes back clean, run it for real.

### The destructive cases, and their traps

- **Dropping a column** — deploy the code that stops reading it *first*, then drop it in a
  later deploy. A drop is not reversible; the data is gone.
- **`NOT NULL` on an existing column** — fails outright if any row is null. Backfill first,
  in a separate migration.
- **Renaming** — never rename in one step. Add the new name, backfill, switch the code, drop
  the old one later. A rename is a drop and an add wearing one hat.

---

## 3. When it is not your code

Check these before touching anything, because rolling back will not help and wastes the
minutes that matter.

```bash
curl -i https://shopalexandris.vercel.app/api/health
```

- **200** — the app is up and the database is reachable. The problem is narrower than it looks.
- **503** — the app is running but **cannot reach the database**. Almost always Neon: a paused
  branch on the free tier, exhausted connections, or maintenance. Check the Neon dashboard.
  Deploying will not fix it.
- **No response / 5xx from the platform** — Vercel itself. Check its status page.

Sentry reports what *throws*. It cannot tell you the site is down, because nothing is running
to throw — which is exactly what the uptime monitor on `/api/health` is for.

---

## 4. Data problems

Wrong values, not wrong code. Rolling back a deployment does not un-write a row.

**Look at `/admin/activity` first.** Since `OBS-003` the audit trail records who changed
prices, deleted products or reviews, issued gift cards and discounts, moved order status, and
changed settings — with the previous value captured for the ones that overwrite. That usually
answers "what happened" faster than reading the database.

Neon keeps a point-in-time restore window. **Restore into a branch, never over production** —
then compare, and copy across only the rows that need it. A full restore rolls back every
order placed since that point, which turns a data problem into a customer problem.

---

## After any rollback

1. **Say what happened in `AUDIT.md`'s changelog.** An incident nobody wrote down happens
   twice.
2. **Check Sentry** for the errors the bad deploy produced, and resolve them so the next
   real error is not buried in noise.
3. **Add the test that would have caught it.** Both post-audit findings (`SEC-005`,
   `BUG-001`) came from running the app rather than reading it, and both are pinned by tests
   now precisely so they cannot come back quietly.

---

## Things that are already safe, and why

Recorded so nobody wastes an incident re-deriving them.

- **Concurrent checkout on the last unit** — the conditional `UPDATE … WHERE quantity >= n`
  makes the affected-row count the availability check. Verified through Neon's pooler, not
  just a direct connection.
- **A webhook arriving twice** — `@@unique([provider, eventId])` suppresses the replay.
- **A double-submitted order** — `Order.checkoutId` is unique, and the loser reads back the
  winner's order rather than erroring.
- **A provider that hangs** — every outbound payment, courier and OAuth call is now bounded
  (`REL-001`), so a supplier's outage cannot exhaust this shop's capacity.
- **A failed audit-log write** — never rolls back the action it was recording.
