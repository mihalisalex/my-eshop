# Production Readiness Audit

**Audited:** 2026-09-03 · commit `be0d546` · Next 16.3, Prisma 7.9, Neon Postgres, Vercel
**Remediated:** 2026-09-04 → 2026-09-08 · Phases 1–4, post-audit findings, and a day of owner-driven changes
**Re-checked against production:** 2026-09-04 (added `OPS-001`, `OBS-003`, `REL-001`), 2026-09-05 (added `BUG-002`, `A11Y-002`), 2026-09-06 (`OPS-001` escalated) and 2026-09-07 (`OPS-001` **de-escalated** — its evidence of failure turned out to be three measurement defects, and Vercel's scheduler is demonstrably firing) and 2026-09-08 (**all three `OPS-001` jobs observed running on the scheduler**, one confirmation night left)
**Scope:** 564 TS/TSX files, ~52,000 LOC, 52 API routes, 22 server-action files, full config surface
**Verified with:** `tsc --noEmit` ✓ · `eslint` ✓ · `vitest` **531/531** ✓ (30s hook timeout — see `TEST-001`; on the 10s default the two DB suites fail on a cold Neon branch) · `playwright` **42 specs**, green in two halves rather than one run — see below ✓ · `next build` ✓ · `npm audit` · live production DB queries · a forced Sentry event · an axe WCAG 2.1 A/AA scan · a Neon test branch for anything that writes

## Verdict

**READY TO LAUNCH.** Overall **74 → 93**.

The original audit found no P0 and rated the shop 74/100, blocked not by its code but by two
things: it could not be seen failing, and its riskiest code had no automated coverage. Both
are now closed.

**All 3 P1 launch blockers are closed. 15 of 17 P2s are closed**, with one deferred
(`SEC-003`, the CSP nonce) and one open.

**`OPS-001` — the retention cron.** Opened as a *suspicion* on 4 September, on the grounds that a
subsystem nobody has watched run is not a subsystem known to work. It ran down to a live bug:
the job had never executed, so the GDPR retention `PRIV-001` describes was not actually being
honoured. A manual trigger has since cleared ~1,700 rows and proved the code, the route and
`CRON_SECRET` all correct. The schedule itself, re-measured on 6 September, **still does not
fire** — and by then every proposed explanation had been eliminated, including the plan-limit
guess this document had been carrying. It is a platform problem, not a code one.

On 7 September the finding turned out to have been **measuring itself wrongly since the 5th**.
Three separate defects: the marker test it set could not discriminate (the rate limiter's own
prune deletes the same rows); the overdue-row count it treated as proof of failure is the
*normal steady state* of a working daily job; and every timestamp the tooling printed was
three hours early, because `createdAt` is a timezone-less column and node-postgres reads such
columns in the client's local zone. Meanwhile the `email-followups` cron is demonstrably
firing inside its slot on five dated occasions — **Vercel's scheduler works on this project.**

The 09-05 finding survives all of that: 1,639 rows with the oldest 45 days old was real, and
retention genuinely had never run. What is no longer established is that it has failed since.
Two things shipped regardless, and both earn their place either way: every scheduled job now
records when it ran and **what triggered it**, and retention runs from ordinary request
traffic when a day passes with no recorded run — verified in production, 492 overdue rows to
zero without a human.

**On 8 September the next slot answered it.** All three jobs recorded a run with
`trigger: schedule` — retention 03:49:37Z, `email-followups` 08:56:47Z, `instagram-token`
04:12:10Z — and **0 rows predate the last pass's own cutoff**, the only count that can show a
pass failed. The finding's own sentence, *never been observed running*, is no longer true of
any of the three. It stays open on one point only: retention has a single scheduled day on
record, and one run after three failed slots is as easily a coincidence as a recovery. A
second consecutive night closes it.

That day also produced a corollary to the rule this finding taught. At 08:25 UTC
`email-followups` still read `never` and looked broken; its slot had not closed, and Hobby's
precision is ±59 minutes. It fired at 08:56. **Ask what a passing result would look like —
and whether a failing one was even possible yet.**

**`PRIV-002` — GDPR access and erasure — is now built, and on 8 September it turned out not to
have been.** Export and erasure as admin actions, with erasure implemented as anonymisation
where tax law requires the record kept: the order survives with its accounting facts, stripped
of every identifying field. All of that was true and none of it was reachable — the two actions
had no caller, so for three days this file recorded a fixed finding whose stated symptom, *no
way to answer the request*, was still exactly true. It is reachable now. **This file's own
standing rule caught this file:** `Fixed` means shipped, not working.

**The habit that produced most of this file.** Eight findings were opened *after* the original
audit, and every one came from running or measuring the system rather than reading it again:
a CSP policy the browser silently discarded, a wishlist race seen in a real 500, a Sentry
integration reporting nothing behind a one-letter typo, a cron that had never fired, an audit
verb nothing ever wrote, unbounded provider calls, a buy button that swallowed clicks, and
colour swatches that announced as nothing. **A clean read is not a clean run**, and the file
now carries a standing rule to that effect: `Fixed` means shipped, not working.

> With bank-transfer only + manual reconciliation: **ready.**
> Before enabling card payments: PAY-001 is fixed, so that gate is open too.

---

## Progress

| Severity | Total | Open | Done | Deferred |
|---|---:|---:|---:|---:|
| P0 — Critical | 0 | 0 | 0 | 0 |
| P1 — Launch blocker | 3 | 0 | **3** | 0 |
| P2 — Medium | 17 | 1 | **15** | 1 |
| P3 — Low | 12 | 1 | **10** | 1 |
| INFO | 8 | — | — | — |

**Every finding opened after the original audit came from running or measuring the system** —
`SEC-005`, `BUG-001`, `OPS-001`, `OBS-003`, `REL-001`, `BUG-002`, `A11Y-002`, `PRIV-002`, `PERF-002`,
`PERF-003`, `SEO-002` and `PERF-004` — the last of which came from the **owner** noticing the buy
button felt slow, which is the one source of findings no audit pass replaces. Not one would have been found by reading the code again more carefully. The last two
are the clearest cases: both came from asking why a score was low and then measuring, and the
same habit later showed that `PERF-002`'s fix had **already worked** while this file was still
recording it as a deliberate no-op.

**One exception arrived on 8 September, and it sharpens the claim rather than weakening it.**
`PRIV-002` had to be re-opened because its two admin actions had no caller, and that was found
by `knip` — a static pass, the very thing this paragraph says found nothing. The sentence above
is still true of every *behavioural* defect in the list: none of them would have surfaced from
reading more carefully, and a dead-code tool would have reported nothing about any of them.
What the exception adds is that **"run it" and "read it" fail in different directions.** An
unwired action renders no page, so exercising the shop cannot find it; a mis-priced shipping
rate is perfectly well-formed code, so no static pass can. The mistake was not preferring
running over reading — it was never running the cheap deterministic pass at all, for four days,
while doing the expensive one repeatedly.

**One P2 is open**, and on 7 September it moved in the opposite direction to the one this file
had been recording. Its evidence of continued failure turned out to be three separate
measurement defects, and `email-followups` is demonstrably firing inside its slot — so
Vercel's scheduler works, and `data-retention` is no longer *shown* to be broken. It is also
no longer load-bearing: retention runs from ordinary traffic when a day passes with no
recorded run, verified in production. What keeps the finding open is that the schedule has
still never been **observed** running, which is the standard it was opened to enforce and
which the run log now makes answerable in one command.

**One P3 is open and one is deferred.** `PERF-001` (image optimization) waits on the plan, as
does the deferred P2 `SEC-003`. **`PERF-002` is now deliberately deferred** — its fivefold TTFB
gain already landed via the pre-step, and what remains would only improve the cache-miss path, at
the cost of a services-layer migration. It carries a reason and two triggers rather than sitting
on the list as work anyone is behind on. `SEO-002` is **fixed** — the 404 moved to the proxy, which runs before the response begins.

`PERF-003` — the one that needed no permission from anyone — was **done on 6 September**, and
came in at twenty times its estimate: 309 images and **16.77 MB**, not 15 images and 1.2 MB.
Doing it is also what surfaced `SEO-002`, which is the argument for clearing the unblocked item
rather than leaving it to sit.

**Status legend:** `[ ]` open · `[~]` in progress · `[x]` done · `[-]` deferred (reason required)

**How to use this file:** fix one item, tick its box, fill in its `Fixed:` line with the commit hash, and update the Progress table in the same commit. Anything marked `[-]` needs a one-line reason so it is never silently re-opened.

### The standing rule this audit learned the hard way

> **`Fixed` means the code shipped. It does not mean the thing works.**
> Nothing is finished until it has been *observed working in production*, and the entry says
> how it was observed.

### And a companion rule the suite keeps teaching

> **A red browser suite is not the same as a broken shop — check what the failures have in**
> **common before diagnosing the app.**

The suite has 42 specs and **does not pass in a single run**, for a reason that is not a defect.
A full pass takes ~9 minutes and runs desktop before mobile, which is longer than the shop's own
`cart-create` window — 60 requests per 10 minutes, in `app/api/cart/route.ts`. Desktop spends the
budget; every mobile cart test then fails against a limiter doing precisely its job. Run on their
own, those same tests pass, which is how this is confirmed rather than assumed.

This has now cost two separate investigations in this document — once chasing a phantom mobile
add-to-cart bug that was 120 of my own requests, and once on 6 September when four mobile cart
specs failed straight after an unrelated data migration and looked exactly like its fallout. Both
times the tell was the same: the failures were all mobile, all cart, and all fine alone.

Three times in two days, something was wired, type-checked, built, deployed, reviewed and
wrong: Sentry reported nothing for a day because the variable was named `SENTRY_DNS`; the
retention cron had never once executed; and the audit log's `order.status_changed` verb had
existed since `OBS-002` without a single line of code ever writing it. Each was marked done and
counted in the score before anyone watched it run.

So every `Fixed:` line should carry its evidence — a forced event, a row count, a query result,
a screenshot — and a finding that cannot yet be observed stays open, however complete the code
is. `OPS-001` exists purely to enforce this, and it caught a real defect within a day.

The same rule is why `BUG-002` was findable at all: it was invisible to 443 unit tests and
visible on the first browser click.

---

## Before going live — what is actually left

Nothing here is a P0, and the shop is already taking real orders (**6** in the database), so
treat this as hardening rather than a gate.

### Still open

| # | Item | Owner | Where it stands |
|---|---|---|---|
| 1 | **All three scheduled jobs observed firing — one confirmation left** (`OPS-001`) | You — one command tomorrow morning | 🟡 **Downgraded 2026-09-07.** The evidence that it was still failing was three measurement defects, not a broken cron, and `email-followups` fires inside its slot on five dated occasions — so **Vercel's scheduler works here**. `data-retention` is no longer shown to be broken; it has simply never been watched. Retention is enforced regardless, from ordinary traffic, verified in production. ✅ **2026-09-08:** all three jobs recorded a run with `trigger: schedule` — retention 03:49:37Z, email-followups 08:56:47Z, instagram-token 04:12:10Z — and **0 rows predate the last pass's own cutoff**. Open only until `data-retention` fires a second consecutive night; run `npm run cron:status` tomorrow morning. |
| 2 | **Restore window is only 6 hours** | You — **plan decision** | 🔴 Discovered by the restore drill. A problem noticed the next morning **cannot be restored away**. See `ROLLBACK.md`. |
| 3 | **Re-enable image optimization** (`PERF-001`) | You — billing | ⏳ The largest single score gain left: Performance 74 → ~85. |
| 4 | **The CSP nonce** (`SEC-003`) | You — decision | ⛔ Still deferred, but **not for the reason first given**. The "it would force dynamic rendering" argument was disproved by `PERF-002`: that had already happened. It stands on the other three grounds — no injection sink exists, highest blast radius, and the proxy matcher does not cover checkout. |
| ~~5~~ | ~~**Adopt Cache Components route by route**~~ (`PERF-002`) | — | ⛔ **Deliberately deferred 2026-09-07.** The fivefold TTFB gain already landed from the pre-step, and the CDN is doing what PPR would do — three routes the build calls *dynamic* all serve in ~0.2–0.3s. What remains improves only the cache-miss path, at the cost of a services-layer migration. Two triggers to revisit, in its entry. |
| ~~6~~ | ~~**Unknown URLs answer 200**~~ (`SEO-002`) | — | ✅ **Fixed 2026-09-06.** The 404 moved to `proxy.ts`, which runs before the response begins and was already doing the lookup for renamed-slug redirects. Costs no extra query on two of the three routes. |

**Nothing on this list is code any more.** Items 1–4 are decisions or a platform problem, and
items 5 and 6 are closed — `PERF-003` and `SEO-002` were the two that only needed someone to do
them, and the first is what surfaced the second. `PERF-002` was the last piece of queued work,
and it is now **deferred on evidence rather than blocked**: its headline gain is banked, and the
remainder is a large refactor whose value arrives with traffic or translation.

**The one thing here that is actually wrong is item 1.** `OPS-001` is not a performance
preference — the retention cron does not run, so the GDPR retention `PRIV-001` describes is not
being honoured without a manual trigger. Everything else on this list is a choice about money or
timing.

### Closed on 6 September

| Item | Evidence |
|---|---|
| **`PERF-003` — 311 catalogue JPEGs re-encoded to WebP** | 309 converted, 2 refused by the size guard, **0 failed**. 32.39 MB → 15.61 MB, **16.77 MB saved (52%)**. Quality measured at **PSNR 42.7–48.9 dB**, above the ~40 dB visibility threshold. 315 database references rewritten in one transaction; originals kept, backup taken, reverse mapping saved. Verified after: 64 images across four pages, **zero broken**. |

### Closed on 4–5 September

| Item | Evidence |
|---|---|
| `sslmode=verify-full` pinned | Verified in the runtime logs: the same product page that logged an `[error]` warning now logs `[info]` with none |
| Uptime monitoring live | 9 probes in 45 minutes, all 200, every 5 minutes |
| Sentry alert throttled | `Send a notification for high priority issues` changed from *notify on every trigger* to **1 day**; sidebar confirms "Throttling: 1 day" |
| **Backup restore drilled** | Branch from a past point ready in **2.5s**; data genuinely rewound (789 rate-limit rows vs 1,080 live); branch deleted |
| `PRIV-002` — no way to answer a GDPR access or erasure request | Export and erasure as admin actions; orders kept and anonymised rather than deleted, per Art. 17(3)(b). 7 tests on the branch. **Re-opened and re-closed 2026-09-08** — the actions had no caller until then, so the symptom survived its own fix |
| `BUG-002` — the buy button swallowed early clicks | Same spec with no settle: fails on production, passes on the fix, passes on production after deploy |
| `A11Y-002` — colour swatches announced as nothing | Found by the axe scan on its first run; zero WCAG 2.1 A/AA violations across six pages now |
| `TEST-001` — `completeCheckout` had no end-to-end test | Ten concurrent buyers, one unit → one order, stock floors at zero, against the real service |
| `REL-001` — unbounded provider calls | Stripe 15s, ACS 10s, OAuth 8s, each justified by consequence |
| `OBS-003` — audit log covered 2 of ~12 admin surfaces | Widened to 8; also found a verb declared since OBS-002 that nothing ever wrote |
| The 9 seeded fake reviews | Deleted; both product pages verified to omit `aggregateRating` rather than emit a zero |

---

### The exact steps for the no-code items

Detail for rows 1–4, 7 and 8 of the table above — the settings, values and commands, so none
of it has to be reconstructed later.

1. **Retention cron** (`OPS-001`). `CRON_SECRET` is confirmed correct — a manual
   `npx vercel crons run /api/cron/data-retention` returned 200 and did the work. The only
   open question is whether the 03:30 UTC slot fires unaided. After the next one, run:
   ```sql
   SELECT COUNT(*) FROM rate_limit_attempts WHERE "createdAt" < now() - interval '2 days';
   ```
   `0` means the schedule works and this closes. A non-zero number means the third cron is not
   being scheduled, and the fix is to fold the retention pass into one of the two existing cron
   routes so the project declares two jobs rather than three.

2. **Sentry alert rule.** Replace the default. Notify immediately when the event message or
   tags point at the payment or webhook paths; send everything else to a daily digest. The
   principle: page on money, digest on everything else.

3. ~~**Uptime monitor.**~~ **Done 2026-09-05 — in Sentry, not UptimeRobot**, which saved an
   account. Verified from the runtime logs: 9 probes in 45 minutes, all 200, one every 5
   minutes, arriving as `HEAD` requests. The old instructions are kept below for reference.

   Point UptimeRobot (free tier is enough) at
   `https://shopalexandris.vercel.app/api/health`, 5-minute interval, alert on non-200. The
   route already returns 503 with no error detail when the database is unreachable, which is
   exactly the signal a prober needs.

4. ~~**The 9 seeded reviews.**~~ **Done 2026-09-04** — all 9 deleted (5 on SKU `9262`, 4 on
   `585-1`). Worth recording how it was confirmed they were all fabricated: every row had been
   written to the database within **two seconds** of the others, with `createdAt` backdated
   across August. That clustering is the seeding script own signature, and it also proved no
   real customer review was mixed in — the table held only those nine.

   Both product pages were checked afterwards, because the zero-review path had never run on
   them: they return 200, and the JSON-LD now **omits `aggregateRating` entirely** rather than
   emitting a zero. A `Product` carrying `"ratingValue": 0` is invalid schema.org and Search
   Console would have begun reporting rich-result errors within days.

7. ~~**`sslmode`.**~~ **Done 2026-09-05** across production, `.env` and `.env.test`. Verified in the
   runtime logs: the same product page that logged an `[error]` warning now logs `[info]` with
   none. Original note: `pg` warns that `sslmode=require` currently behaves as `verify-full` but
   will adopt weaker libpq semantics in pg v9. Pin `sslmode=verify-full` in `DATABASE_URL`
   and `DIRECT_URL` now to avoid a silent downgrade at some future upgrade.

8. **Image optimization** (`PERF-001`) is off because the Vercel transform quota was exhausted
   and returning 402s, which broke images shop-wide. Re-enable with
   `NEXT_PUBLIC_OPTIMIZE_IMAGES=true` once the plan allows. Purely a billing decision.

---

# P1 — Launch Blockers

## [x] OBS-001 · Observability — the system cannot be seen failing

**Category:** Reliability / Operations
**Location:** repo-wide · `lib/logger.ts` (imported by only 2 files) · no `app/api/health` · no error tracker
**Confidence:** Confirmed

**Problem.** A structured-logging seam exists and is essentially unadopted — the rest of the codebase calls raw `console.error`. There is no error tracking, no alerting, no health endpoint, no correlation IDs, no metrics.

**Failure scenario.** A webhook begins failing signature verification at 02:00. `handleProviderWebhook` correctly stores it and returns 400. The provider retries, then disables the endpoint. **Nobody is notified.** It surfaces days later as customer complaints. Identical exposure for a checkout 500 loop or Neon connection exhaustion.

**Evidence.** `lib/logger.ts` states its own purpose — *"swapping in a real backend later is a change to this one file, not every call site"* — but only 2 of ~200 server files import it.

**Fix.**
1. Add Sentry (or Vercel Log Drains + alert rules).
2. Add `GET /api/health` asserting DB reachability.
3. Alert on `PaymentWebhookEvent.processingStatus = 'failed'`.
4. Route `console.error` in the payment/checkout/webhook paths through `logger`.

**Verify.** Trigger a deliberate webhook signature failure; confirm an alert arrives. Hit `/api/health` with the DB unreachable and confirm non-200.

**Risk of change:** Low — additive only.
**Fixed:** Phase 1 (health endpoint, logger seam, adoption) + Sentry wired. Server-side only — the client SDK is deliberately absent, since every costly failure here is server-side and the browser bundle already carries unoptimized images. Verified the SDK is NOT in the client bundle. A missing DSN is a full no-op, so the app is unchanged until you paste one in. `sendDefaultPii: false`, tracing off, and a `beforeSend` email scrubber, because shipping customer PII to a US processor would undo PRIV-001 on a different axis — the `to: customerEmail` field was also removed at its call site, which is the actual fix. **Completed 2026-09-05.** The uptime monitor is live — in Sentry rather than a separate service — probing `/api/health` every 5 minutes, confirmed arriving in the runtime logs. And the alert rule is throttled: `Send a notification for high priority issues` went from *notify on every trigger* to **once per day per issue**.

Two things learned about Sentry's newer UI, since neither matched the older docs. Issue alerts are not in **Create Alert** at all — that chooser offers only Metric, Cron, Uptime and Mobile Build. They live under **Monitors → Error → the monitor → Project Alerts**. And the throttle is a field called **Action Throttle** in a **Throttling** section at the bottom of the rule editor, not a condition inside the rule.

The default was better than feared, incidentally: it fired on *high priority* issues rather than every new one. The throttle is what stops one recurring failure mailing repeatedly.

**Verified in production, 2026-09-04.** A temporary admin-gated route (`app/api/admin/sentry-check`, since deleted) exercised both halves and both were confirmed to arrive:

| Path | Mechanism | Result |
| --- | --- | --- |
| `logger.error` | `captureException` | Arrived — `Error: This is a test. Nothing is broken.` |
| uncaught throw | `onRequestError` | Arrived — tagged `Unhandled`, attributed to the route |

Both were needed: they are independent mechanisms, and either could have failed alone. The uncaught half is what proves `onRequestError` is wired without `withSentryConfig` wrapping `next.config.ts`.

The test earned its keep immediately — the DSN had been deployed as `SENTRY_DNS`. `Sentry.init` treats an absent DSN as *disabled*, not an error, so the app looked healthy and reported nothing. That is precisely the state this finding is about, and only a forced event could expose it.

Two things learned that are worth not re-learning:
- **`Sentry.flush()` returning `true` proves nothing about delivery.** It resolves when the send queue drains, and an empty queue drains instantly — so it cannot distinguish *sent* from *never queued*.
- **The Issues list lagged the alert email.** The logger event was briefly judged missing on the strength of the list; the email carrying the same event proved otherwise. Confirm with the event, not the list view.

DSN host is `ingest.**de**.sentry.io` — the EU region, so error data stays in the EU. That matters here: a US-region project would have undercut PRIV-001 on the same axis as the PII scrubbing.

---

## [x] TEST-001 · The stateful commerce core has zero tests

**Category:** Testing
**Location:** `services/checkout.ts`, `services/payments.ts`, `services/orders.ts`, `services/carts.ts`, `services/customers.ts` — no test file for any
**Confidence:** Confirmed

**Problem.** 407 passing tests is misleading. They are almost entirely pure-function unit tests in `lib/` (formatting, slugs, SEO, validation, fee math). Verified: **no API route tests, no E2E, no component tests** — `vitest.config.ts` is `environment: "node"` with no JSX plugin; no Playwright, no testing-library.

The most valuable engineering in this repo — the conditional-`UPDATE` oversell guard in `completeCheckout` — **has no test**. A future refactor back to read-check-write would pass CI silently and begin overselling.

**Fix.** Integration tests against a test database covering the four races the code already handles correctly:
1. Concurrent checkout on the last unit → exactly one order, stock floor 0
2. Duplicate `POST /complete` → one order, second returns the first
3. Gift-card double-spend → balance never negative
4. Webhook duplicate / unverified / out-of-order → correct status each time

**Verify.** Each test must fail if its guard is removed. Confirm by temporarily reverting the guard.

**Risk of change:** None to production code.
**Fixed:** Phase 2 — `services/concurrency-guards.test.ts` pins the DB semantics all three guards rest on, running against the real **pooled** connection. Verified the guard survives PgBouncer transaction mode, which was an open question.

**Closed completely on 2026-09-05**, once a Neon test branch existed. `services/checkout.integration.test.ts` now drives the **real service**, not the SQL underneath it:

| Scenario | Assertion |
| --- | --- |
| Ten simultaneous buyers, one unit | Exactly **1** order placed, stock floors at **0**, the other nine rejected *for stock* rather than crashing |
| An ordinary purchase | Stock moves by exactly what was bought |
| The same checkout completed twice | Same order returned, **one** order row, stock decremented **once** |
| No payment method | Refused — no order, stock untouched |
| No address | Refused — no order, stock untouched |

The distinction matters more than it looks. The Phase 2 tests prove *Postgres* behaves; they say nothing about whether `completeCheckout` still uses Postgres that way. **A refactor back to read-check-write would leave every Phase 2 test green while the shop began overselling.** These are the ones that would fail.

**How this is kept safe.** `vitest.setup.ts` redirects the whole test process onto the branch and **refuses to start** if `TEST_DATABASE_URL` resolves to the production endpoint — verified by deliberately pointing it at production and confirming it aborts. It also forces `EMAIL_PROVIDER=dev`, because completing a checkout sends a real confirmation otherwise; a test that mails a customer is not a test.

A side effect worth naming: the concurrency and audit-log tests **used to run against production**, creating and deleting rows in the live shop. They cleaned up after themselves, but "careful about it" and "cannot reach it" are different properties, and only one holds at 2am. They now run on the branch too. Production verified untouched afterwards: 6 orders, zero test artefacts.


### The suite is flaky on a cold database — found and fixed 2026-09-06

Re-running the suite to verify the count this document claims, it **failed** — two files,
both of the Postgres-backed ones, while the other 45 passed. A second run passed 455/455.

Not noise, and worth the entry because of how it fails. Neon **auto-suspends an idle**
**branch**, and waking the compute took longer than Vitest's 10-second default
`hookTimeout`, so both suites died in `beforeAll` before reaching an assertion. The
timings say it plainly: collection took **29.2s** on the cold run against **5.8s** warm.

**This is the worst shape a test failure can take.** It presents as the database being
broken, it hits only the two suites that matter most, and it clears on a re-run — so the
natural response is to run it again, see green, and conclude nothing was wrong. Nobody
would have investigated it; they would have learned to ignore a red first run.

**Fixed** in `vitest.config.ts`: `hookTimeout` and `testTimeout` raised to 30s, with the
reason written next to them. Applied globally rather than per-suite — a pure-function test
never approaches a timeout, so the looser bound costs nothing where it does not apply.

**What is not proven.** The cause is inferred from the timings and from which suites failed,
not from a reproduction: forcing a genuinely suspended branch means waiting out Neon's idle
window, and that was not done. The fix is therefore a well-supported hypothesis, not a
measured before-and-after. If a cold first run ever fails again, this is the first thing to
re-examine rather than the settled answer.

**It also means this document's own `455/455 ✓` was true only on a warm branch.** The
number was accurate; the conditions it needed were undocumented, which is the same class of
problem as the standing rule at the top of this file about `Fixed` not meaning *works*.
---

## [x] PAY-001 · Webhook does not verify amount or currency ← hard gate for card payments

**Category:** Payments
**Location:** `services/payments.ts:866-884` — `handleProviderWebhook` → `applyStatus`
**Confidence:** Confirmed

**Problem.** The pipeline verifies the **signature** and enforces idempotency correctly, but when applying a `succeeded` event it never asserts that the reported amount equals the amount we expected to charge.

```ts
await applyStatus(payment, {
  status: event.status,
  externalPaymentId: event.externalPaymentId ?? undefined,
  failureReason: event.failureReason,
  refundedAmount: event.refundedAmount,   // ← no check against payment.amount
}, …);
```

**Why not P0 today.** Production currently has **only `bank-transfer` enabled** (verified against the live `payment_method_settings` table). No webhook-driven card provider is live, so this is latent.

**Why it is still a blocker.** The moment Stripe is enabled, a signature-valid event carrying a mismatched amount marks an order paid.

**Fix.** In `handleProviderWebhook`, before `applyStatus`, reject (store + `failed`) when `event.amount` is present and does not equal `payment.amount.amount`, or currency differs.

**Verify.** Unit test: signature-valid event with amount ≠ payment amount must not reach `succeeded`.

**Risk of change:** Low, but must not break providers that omit amount — treat absent as "no assertion possible" and log it.
**Fixed:** Phase 2 — `NormalizedWebhookEvent.amount` added, populated from Stripe, enforced centrally in `handleProviderWebhook` before `applyStatus`. Mismatch is stored, refused and logged; an absent amount is recorded as unverifiable rather than passed silently.

---

# P2 — Medium

## [x] SEC-001 · Unauthenticated checkout PATCH returns full PII and permits address overwrite

**Location:** `app/api/checkout/[checkoutId]/route.ts`
**Confidence:** Confirmed

Holding a `checkoutId` lets anyone PATCH a trivial field (`{"giftWrap": false}`) and receive the **entire checkout** — email, phone, shipping and billing address — and **overwrite the delivery address** before the order is placed.

**Mitigating (verified, not assumed):** ids are unguessable cuids, held in `localStorage`/memory, **never in a page URL** (`/checkout`, not `/checkout/[id]`), so they do not leak via `Referer` or browser history. Rate-limited 60/10min. Not enumerable.

**Fix.** Bind the checkout to a signed httpOnly cookie at creation — the grant pattern already implemented in `lib/order-access-cookie.ts` — and narrow the response to the fields the client renders.

**Verify.** PATCH with a valid id but no cookie → 403. Existing checkout flow still completes end to end.

**Risk of change:** Medium — touches the live checkout flow. Test the full purchase path after.
**Fixed:** Phase 3 — `lib/checkout-access.ts`, a signed httpOnly grant issued when the checkout is created and required by both PATCH and `/complete`. Answers 404 rather than 403, so an id nobody may touch is indistinguishable from one that does not exist. Response shape deliberately left alone: the client legitimately renders those fields, and narrowing it would risk the live checkout for no security gain once the grant is in place.

---

## [x] SEC-002 · Inconsistent HTML escaping in email templates

**Location:** `lib/email/templates.ts:382` (`firstName`), `:561` (`productName`, `sizeName`), `:155` (`address.firstName/lastName`)
**Confidence:** Confirmed

`escapeHtml()` exists and is correctly applied to `item.name`, `item.color`, `item.size`, `item.image.alt` — but **not** to `firstName`, `friendFirstName`, `productName`, `sizeName`, or address names. The inconsistency is itself the bug: the author knew to escape and missed several.

Worst case: `referralRewardEmail` renders an attacker-chosen `friendFirstName` into **someone else's inbox** — HTML/phishing-content injection inside a legitimately-signed transactional email.

**Fix.** Wrap the five interpolations in `escapeHtml()`. Text (non-HTML) variants need no change.

**Verify.** Register with a name containing `<b>x</b>`; confirm it renders literally in the email body.

**Risk of change:** Very low.
**Fixed:** Phase 1 — all five interpolations escaped, pinned by `lib/email/templates.test.ts`.

---

## [-] SEC-003 · CSP allows `'unsafe-inline'` for scripts in production

**Location:** `next.config.ts` — `CONTENT_SECURITY_POLICY`
**Confidence:** Confirmed · already documented in-file (QA-057)

Dev-only `unsafe-eval` was correctly removed, but `unsafe-inline` remains in both environments, which negates most of the CSP's XSS value. No injection sink currently exists, so this is defence-in-depth rather than an active hole.

**Fix.** Per-request nonce generated in `proxy.ts`, threaded through Next's inline bootstrap, the consent script and Framer Motion's inline styles.

**Risk of change:** Medium — a missed inline script breaks the page. Do this deliberately, not casually.
**DEFERRED — not done, and deliberately so.** Three reasons, in order of weight:

1. **No injection sink exists to exploit.** The audit verified this rather than assumed it: two `dangerouslySetInnerHTML` in the whole codebase (JSON-LD, which escapes `<` and U+2028/29, and one static literal), zero `$queryRawUnsafe`, zero `Prisma.raw`. `unsafe-inline` is currently guarding a door with nothing behind it.
2. **It is the highest-blast-radius change in the plan.** A missed inline script does not degrade — it breaks all JavaScript site-wide.
3. **The matcher makes it worse than it looks.** `next.config.ts` sets headers statically; a nonce must be minted per request in `proxy.ts`. But that matcher covers only `/admin`, `/account`, `/category` and `/products` — **not the homepage, cart or checkout**. Moving CSP there as-is would strip it from the most sensitive pages in the shop; widening the matcher runs middleware on every request, which is its own regression.

**To do it properly** (a deliberate session, not an unattended one): widen the matcher to `/((?!_next/static|_next/image|favicon.ico).*)`, keep the early returns so no extra DB work runs, mint a nonce per request, pass it via a request header, read it in `app/layout.tsx`, and emit `script-src 'self' 'nonce-…'`. `style-src` keeps `unsafe-inline` — Framer Motion writes inline styles. Verify every page renders and the console is clean before merging.

### ⚠️ Correction, 2026-09-05: the fourth reason below is wrong for THIS shop

`PERF-002` measured what the argument below assumed. **Every page already renders
dynamically** — the root layout reads a cookie for the locale, and has done for months. There
is no static generation left for a nonce to cost. The reasoning was sound in general and
untrue here, and it was asserted without checking.

The first three reasons still stand on their own: no injection sink exists, the blast radius is
the highest in the plan, and the proxy matcher does not cover checkout. The nonce remains
deferred — but on those grounds, not on a cost that had already been paid.

### The fourth reason, recorded 2026-09-04 — since disproved for this shop

Attempted during the autonomous session; **stopped before writing any code**, because Next's
own bundled guide (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`)
states a consequence none of the three reasons above accounted for:

> When you use nonces in your CSP, **all pages must be dynamically rendered**. […] Static
> optimization and Incremental Static Regeneration (ISR) are disabled. Pages cannot be cached
> by CDNs without additional configuration.

A nonce must be unique per request, so it can only be applied during server-side rendering.
That converts **the entire storefront** — homepage, every category page, every product page —
from statically generated and CDN-cached to dynamically rendered on every request.

**Why that decides it for this shop specifically.** `PERF-001` exists because the Vercel
image-transformation quota was exhausted and started returning 402s, breaking images
site-wide. This is an account already sitting against its plan limits. Trading static
generation for dynamic rendering on every page multiplies serverless invocations on exactly
that account — to defend against an injection sink the audit verified does not exist.

The cost is real and immediate; the benefit is hypothetical. **That is not a trade an
unattended session should make**, so it was not made. It is a decision for the shop owner,
alongside a Vercel plan decision.

**The alternative worth evaluating first.** The same guide documents experimental
hash-based CSP via Subresource Integrity (`experimental.sri`), which hashes scripts at build
time and **keeps static generation and CDN caching**. It is App Router only and marked
experimental, so it needs its own evaluation — but it is the path that removes
`unsafe-inline` without paying for it in rendering, and it should be tried before the nonce
route is considered.

---

## [x] SEC-004 · Verify `x-forwarded-for` trust — rate limiting may be bypassable

**Location:** `lib/rate-limit.ts:57` — `getClientIp`
**Confidence:** **Needs runtime verification** ← do this first, it is 30 minutes

`getClientIp` takes the **leftmost** `x-forwarded-for` value. If the platform *appends* rather than *overwrites* the header, an attacker sets it themselves and bypasses **every rate limit in the app, including admin login brute-force protection**. Vercel is believed to normalize this, but it cannot be confirmed from the repo.

**Fix.** Prefer `x-vercel-forwarded-for` (platform-set, not client-settable); fall back to `x-forwarded-for`.

**Verify.** From an external host, send `X-Forwarded-For: 1.2.3.4` to a rate-limited endpoint and confirm the recorded key uses the real client IP, not the spoofed one.

**Risk of change:** Very low.
**Fixed:** Phase 1 — platform headers preferred over client-settable `x-forwarded-for`; pinned by `lib/rate-limit.test.ts`.

---

## [x] PAY-002 · Refund read-check-write race

**Location:** `services/payments.ts:705-730` — `refundPayment`
**Confidence:** Confirmed (theoretical race; narrow window)

Reads `refundedAmount`, checks `remaining`, calls the provider, then applies. Two concurrent refunds can both pass the check. This is inconsistent with the conditional-`UPDATE` rigor applied to stock and gift cards in `completeCheckout`.

Narrow (admin-only, requires a double-submit) and the provider may reject the duplicate — but it moves money.

**Fix.** Guard with a conditional update, matching the existing pattern:
`updateMany({ where: { id, refundedAmount: { lte: amount.amount - requested } }, … })` and treat `count === 0` as a conflict.

**Verify.** Two simultaneous refund calls for the full amount → exactly one succeeds.
**Fixed:** Phase 2 — the amount is now claimed with a conditional UPDATE *before* the provider is called, and released if the provider throws. Guarding on the way out would not have helped: by then the money has already moved.

---

## [x] PRIV-001 · Webhook payloads retained indefinitely (GDPR)

**Location:** `prisma/schema.prisma` — `PaymentWebhookEvent.rawPayload`
**Confidence:** Confirmed

Verbatim webhook bodies (100KB cap) are stored forever. For card providers these contain names, emails, addresses and card metadata. The shop operates in Greece — GDPR applies, and indefinite retention of payment PII has no lawful basis once forensic need has passed.

**Fix.** Retention job purging `rawPayload` (or the row) older than 90 days. A Vercel cron already exists as a pattern in `vercel.json`.

**Verify.** Seed a row dated 100 days ago; confirm the job clears it and leaves a 10-day-old row intact.
**⚠️ The code is correct and has never executed — see `OPS-001`, confirmed 2026-09-05.** Nothing below is currently being enforced in production. Read this entry as "implemented", not "in effect".

**Fixed:** Phase 3 — `services/data-retention.ts` + a nightly cron. Webhook payloads are BLANKED at 90 days rather than deleted: the row is the audit trail, and dropping it would free the `(provider, eventId)` unique constraint that makes replay suppression work. Rate-limit rows (IP addresses) now purge on a schedule at 2 days instead of opportunistically on 1% of calls.

---

## [x] OBS-002 · No admin audit log

**Location:** repo-wide · `constants/permissions.ts` documents the removal of `admin:activity`
**Confidence:** Confirmed

Refunds, customer-PII access, role changes and order edits are **not recorded anywhere**. The permissions file itself notes `admin:activity` was removed "with the seeded activity log it gated… It comes back with the real AdminAuditLog." That log was never built.

For a system where staff issue refunds and read customer addresses, this is both an operational blind spot and a compliance gap.

**Fix.** `AdminAuditLog` table: actor, action, target type/id, before/after summary, timestamp, IP. Write from `requireCapability`-guarded mutations, starting with refunds, role changes and order edits.

**Verify.** Issue a refund; confirm a row with the correct actor id.
**Fixed:** Phase 3 — `AdminAuditLog` (migration `20260904091000`) + `services/audit-log.ts` + a read-only `/admin/activity` page behind a restored `admin:activity` capability. Records refunds, manual payment confirmations, role changes and account deletions. No FK to AdminUser and the actor email is denormalised on purpose: a trail that cascades away with the account erases exactly the record that matters most.

---

## [x] AUTH-001 · Password reset does not invalidate existing sessions

**Location:** `lib/password-reset.ts` · `lib/customer-auth.ts` (7-day JWT) · `lib/auth.ts` (1-day JWT)
**Confidence:** Confirmed

Sessions are stateless JWTs. After a compromise-driven password reset, the attacker's existing session remains valid until natural expiry — up to 7 days for a customer.

**Fix.** Add `sessionsValidFrom: DateTime` to `Customer`/`AdminUser`; set it on password change/reset; reject tokens issued before it in the session DAL (`lib/customer-session.ts`, `lib/admin-session.ts` — both already do a DB read per request, so this is nearly free).

**Verify.** Sign in on two browsers, reset the password in one, confirm the other is signed out on next request.
**Fixed:** Phase 3 — `sessionsValidFrom` on both account models (migration `20260904090000`), compared against the token own `iat` in each session DAL, set on every password change and reset. Free at read time: both DALs already read the row. Pinned by `lib/session-validity.test.ts`, including the seconds-vs-milliseconds mismatch that would make the guard silently never fire.

---

## [x] AUTH-002 · Login timing oracle enables user enumeration

**Location:** `app/admin/actions.ts:26` · check `app/api/auth/sign-in` for the same shape
**Confidence:** Confirmed

```ts
const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
```

No bcrypt work happens when the user does not exist, so absent accounts respond measurably faster — a reliable enumeration oracle even through the rate limiter.

**Fix.** Compare against a fixed dummy bcrypt hash on the miss path so both branches cost the same.

**Verify.** Time 20 requests for a known vs unknown email; distributions should overlap.
**Fixed:** Phase 1 — `lib/password.ts` `verifyPassword()` compares against a dummy hash on the miss path; adopted by both login routes.

---

## [x] SEC-005 · CSP silently discarded both Instagram image sources

**Category:** Configuration / SEO-visible bug
**Location:** `next.config.ts` — `REMOTE_IMAGE_SRC`
**Confidence:** Confirmed — observed as a live browser console error, not inferred
**Found:** during Phase 4 verification, not in the original audit

`img-src` was derived from `REMOTE_IMAGE_HOSTS` so the policy could never drift from what
`next/image` accepts — a good idea that hit a syntax mismatch. The two use different
wildcards: `remotePatterns` has `*.` (exactly one label) and `**.` (one or more), while CSP
has only `*.`, which already matches any depth.

Emitting `**.cdninstagram.com` is not a stricter rule, it is an **invalid source**. The
browser discards the whole entry:

```
The source list for the Content Security Policy directive 'img-src' contains an
invalid source: 'https://**.cdninstagram.com'. It will be ignored.
```

**Why it mattered.** Instagram serves each photo from a region-suffixed host
(`scontent-ath3-1.xx.fbcdn.net`), so the homepage feed was permitted by `remotePatterns` —
Next would happily render it — while the CSP line meant to allow it was thrown away, leaving
every image blocked. Latent only because the feed falls back to curated images until a Meta
token is connected; it would have surfaced as "the Instagram section is blank in production"
with nothing but a console violation to explain it.

**Fixed:** Phase 4 — `**.` is collapsed to `*.` when building the CSP string. Pinned by
three tests in `lib/image-hosts.test.ts`, including one asserting no configured host can
ever emit `**` again. Verified in the browser: the console errors are gone.

---

## [x] BUG-001 · Wishlist get-or-create race returned a 500 in ordinary use

**Category:** Correctness / Race condition
**Location:** `services/wishlists.ts` — `getOrCreateWishlistRow`
**Confidence:** Confirmed — reproduced against the real database
**Found:** post-audit, from a real "Something went wrong" seen in the browser

`getOrCreateWishlistRow` did find-then-create with no recovery. Two requests for the same
owner arriving together both find nothing, both INSERT, and the loser hits the unique
constraint on `anonymousId`/`customerId` and returns a 500.

**Evidence.** The server log holds the whole story in three lines — a 200, then a P2002 on
`wishlist.create()`, then another 200, all for the same `ownerId`. WishlistProvider loads on
mount, so a double-invoked effect or two quick navigations is enough: an ordinary-use race,
not a load-related one.

Notably **the same class of bug the codebase had already solved everywhere else** — stock,
gift cards and duplicate orders all recover correctly. The wishlist was simply missed.

**Fixed:** Recovered rather than prevented, because losing this race is harmless: the row the
winner created is exactly the row this request wanted. Catches P2002 and reads back the
winner, the same shape as the duplicate-order recovery in `completeCheckout`. Verified by
racing ten simultaneous first-time loads against the real database — 10 of 10 fulfilled, one
wishlist created, zero rejections, where before the fix nine would have failed. Pinned in
`services/concurrency-guards.test.ts`.

---

## [x] BUG-002 · "Add to bag" is clickable ~1.5s before it works, and swallows the click

**Category:** Correctness / Conversion
**Location:** `components/product/PurchasePanel.tsx` — the add-to-cart control
**Confidence:** Confirmed — reproduced in three ways against production
**Found:** 2026-09-05, by the new Playwright suite, on its first real run

**Problem.** After a shopper picks a size, the button reports itself **enabled** and its label
has already flipped from *Επιλέξτε μέγεθος* to *Προσθήκη στο καλάθι* — but its click handler
is not yet live. A click inside that window does **nothing at all**: no request, no error, no
line item, no message. The button simply appears not to have worked.

**Evidence.** Identical sequence, three click strategies, same page, production:

| Attempt | Result |
| --- | --- |
| Select size → click immediately | ❌ cart empty |
| Select size → **wait 1.5s** → click | ✅ item added |
| Select size → dispatch a DOM `click()` immediately | ❌ cart empty |

A cart row *is* created (`alexandris_cart_id` appears in `localStorage`), so the failure is
specifically the line item, not the cart. Reproduced headless and headed, so it is not a
harness artefact — and hand-driving a real browser slowly always succeeds, which is exactly
why nobody had noticed.

**Failure scenario.** A decisive shopper who knows their size taps size then buy in one motion
— the single most common interaction on the page — and nothing happens. There is no error to
report, so the likeliest outcomes are a second tap, or leaving. On mobile, where taps land
faster than mouse travel, the window is easiest to hit.

**Why every existing test missed it.** 443 Vitest specs at the time, none of which opens a browser. This
is not a logic bug; it is a timing bug between hydration and user input, and it is invisible
to anything that does not actually click.

**Fix.** Keep the control disabled until its handler is genuinely attached, rather than
enabling it on state alone — the label may flip on selection, but `disabled` should lift only
when the click will be honoured. Alternatively, queue a click that arrives early and replay it
once ready. The first is simpler and more honest to the shopper.

**Verify.** Delete the `waitForTimeout(1500)` in
`e2e/purchase-funnel.spec.ts` and the suite must still pass. That line is currently the only
thing making the test green, and it is commented as such.

**Risk of change:** Low, but it is the buy button — it wants its own commit and a real
click-through afterwards.

**Root cause.** `components/providers/CartProvider.tsx` opened every mutation with
`if (!cart) return`, and `cart` is `null` until `getOrCreateCart` resolves. Not just
add-to-cart: quantity changes, discount codes, gift cards and clear-cart shared the same
guard, so any of them fired early was dropped in the same silence. `canAdd` in
`PurchasePanel.tsx` never consulted `isLoading`, so the button was enabled the instant a size
was picked — before the cart it needed existed.

**Fixed:** The bootstrap promise is now held in a ref, and mutations **await** it instead of
bailing. An early click is honoured a moment late rather than lost. A cart that genuinely
cannot be created now throws, so the caller's existing `reportError` tells the shopper instead
of the failure vanishing.

Deliberately not fixed by disabling the button until `isLoading` clears: that trades a lost
click for a dead-looking button, and the shopper still cannot buy. Waiting is what they
actually want.

---

## [x] BUG-003 · The e2e suite makes the shop send real mail to an address that cannot exist

**Category:** Correctness / Deliverability
**Location:** `lib/email/providers/resend.ts` · `e2e/cart-and-checkout.spec.ts:143`
**Confidence:** Confirmed — four sends observed in production, 2026-09-07 08:56 UTC
**Found:** 2026-09-07, while checking whether the `email-followups` cron fires at all (`OPS-001`)

**Problem.** The browser suite runs against **production** by design, and its checkout spec
fills `e2e-test@example.com` to prove the contact step advances. That writes a real checkout
against a real cart. A day later `runAbandonedCartRecovery` finds the cart, resolves the
address from the checkout, and mails it — through Resend, for real.

`example.com` is reserved by RFC 2606 precisely so it can never resolve. Every one of those
messages is a guaranteed hard bounce.

**Failure scenario, and it is not about the wasted call.** Mailbox providers score a sender
on its bounce rate and Resend suspends accounts that accumulate them. The shop has exactly one
transactional mail channel, and the mail that stops arriving first is the mail that matters
most: order confirmations. **A test address in a live sending path is a slow leak in the
shop's ability to talk to its customers**, paid for by real people rather than by the test.

**Evidence.** Four sends at 08:56 UTC on 2026-09-07, all to `e2e-test@example.com`, from the
09-06 e2e run. Six checkouts in production hold a reserved address (`e2e-test@`, `qa-final@`,
`shipping-test@`); of the six carts reachable through them, four had been mailed and **two
were still pending** — they would have gone out at the next 08:00 slot.

**This is the second time test data has reached a live business flow here.** `QA-012` was six
`example.com` orders adding EUR 1,196.43 of revenue that was never taken. That was cleaned up
by deleting rows; nothing stopped the next occurrence, which arrived through a different door.

**Fix.** `isUndeliverableAddress` (`lib/email/deliverability.ts`) — the RFC 2606/6761 reserved
domains and TLDs — checked in the Resend provider, which is the only place that can put a
message on the wire. One guard at the boundary rather than one per job, because there is more
than one route to a test address and a per-route guard is one that gets forgotten on the next
route.

It **returns rather than throws**, which is the deliberate half. Callers read a throw as a
send failure: `runAbandonedCartRecovery` would count it failed and never set
`abandonedCartEmailSentAt`, so the same cart would be retried and warned about every day
forever. Skipping and letting the caller mark it handled is the behaviour that ends. No
`EmailLog` row is written, because nothing was sent — a row would put mail in the admin Emails
page that does not exist, which is precisely the defect `lib/email/index.ts` already documents
from the `EMAIL_PROVIDER=Resend` capitalisation bug.

Deliberately a fixed list of reserved names, not a "looks like a test address" heuristic.
Anything cleverer eventually refuses to mail a real customer, and the two errors are not
equally bad: a missed test address costs one bounce, a misclassified customer silently loses
their order confirmation.

**Verify.** `lib/email/deliverability.test.ts` — 21 cases, weighted toward the false-positive
side (`example.com.gr`, `examples.com`, `myexample.com`, `protest.com`, `contest.gr`,
`invalidation.com`, `test@gmail.com` must all still be mailable).

**The residue** is cleared by `scripts/purge-e2e-data.ts` — six carts carrying a test checkout
and 140 empty guest carts over a week old, 146 of 516. Neither group affects money (`orders`
holding a reserved address: **0**, so `QA-012` has not regressed), which is why the mail guard
above was the urgent half and this is the tidy-up.

Two deliberate differences from `purge-test-orders.ts`, both in the safe direction:

**Dry run is the default; deleting needs `--apply`.** That script worked from a hand-checked
list of six known order ids. This one selects *by rule*, and a rule that is slightly wrong on
a live shop deletes a real shopper's basket — silently, instantly, looking to them like the
site losing their items.

**`Order.checkoutId` has no foreign key, and the script compensates.** There is no
`orders_checkoutId_fkey` in any migration; it is a plain unique column, while
`checkouts.cartId` is `ON DELETE CASCADE`. So deleting a cart silently deletes its checkouts,
and **nothing in the database prevents that from orphaning an order's pointer** to the session
that produced it — the pointer `services/checkout.ts` calls permanent. Postgres will not catch
this, so the script loads every ordered checkout id up front and excludes any cart touching
one. Worth knowing beyond this script: that FK gap applies to anything that ever deletes a
cart.

The empty-cart group is gated on **age**, which is its entire safety margin: a visitor reading
a product page right now owns a cart with no items, no customer and no checkout — byte for
byte what the suite leaves behind. Only age separates them.

**Risk of change:** Low — additive, and it can only ever prevent a send to a domain that has
no MX record by standard.
**Fixed:** `f9b4560`

---

## [x] BUG-004 · `Order.checkoutId` is called permanent, has no foreign key, and one is already dangling

**Category:** Correctness / Data integrity
**Location:** `prisma/schema.prisma` (`Order.checkoutId`) · `services/carts.ts:315` · `services/checkout.ts`
**Confidence:** Confirmed — one production order affected, mechanism identified
**Found:** 2026-09-07, by verifying the `purge-e2e-data` run rather than trusting its summary

**Problem.** `services/checkout.ts` describes `Order.checkoutId` as "a permanent unique
pointer to the exact session that produced it". Unique it is — there is a unique constraint.
Permanent it is not: **there is no `orders_checkoutId_fkey` in any migration**, so it is a
plain column, while `checkouts.cartId` is `ON DELETE CASCADE` from `carts`. Anything that
deletes a cart takes its checkouts with it, ordered or not, and the database raises nothing.

**And something does delete carts in the normal course of business.**
`mergeCarts` (`services/carts.ts:315`) deletes the guest cart row when a
shopper signs in holding one. If that guest cart had already produced an order — easy, because
cart rows are reused indefinitely rather than replaced after a purchase — the order's pointer
is orphaned at sign-in.

**Evidence.** Order `cmteq0yc3001j04la6o1cj52u` (2026-08-29) points at checkout
`cmrx8d1yn000304jmfqygm5ap`, which does not exist. The id encodes a creation time around
2026-07-22, five weeks before the order: a long-lived guest cart, ordered from, then merged
away on a later sign-in. **Not caused by the purge that found it** — that run deleted six
checkouts, all holding reserved addresses, and `completeCheckout` copies the checkout's email
onto the order, so an order reading `mihalisalex@gmail.com` cannot have come from any of them.

**Impact today: none, and that is worth being precise about rather than alarmed.** `Order`
stores its own Zod-validated snapshots of `lineItems`, `totals`, `shippingAddress`,
`billingAddress` and `shippingRate`, taken at purchase time. Nothing a customer or an
accountant needs lives only in the checkout row, and no application code joins an order back
to it — `checkoutId` appears in `services/checkout.ts` and tests, nowhere else. The
idempotency guard still works, because it queries `orders` by `checkoutId` rather than
following it.

**Failure scenario.** Someone adds an admin view that joins an order to its checkout session —
a reasonable thing to want, and the comment above it says the pointer is permanent. It works
for every order they test and throws on one from 2026-08-29.

**Fix.** Three options were on the table, in increasing cost:

1. **Correct the comment only.** The claim was itself a hazard — code gets written against
   documented guarantees — but it fixes nothing.
2. **Refuse to delete an ordered cart** in `mergeCarts`: move the line items and leave the row.
   Cheap, no migration; ordered guest carts then accumulate, which at this shop's six orders is
   nothing.
3. **Add the foreign key** with `ON DELETE RESTRICT`, turning option 2 from a convention into a
   rule — at the cost of a hand-applied migration on a live shop and a sign-in path that now
   fails loudly where it used to succeed quietly.

**Chosen: 1 + 2.** `mergeCarts` now empties an ordered guest cart instead of deleting it, and
the comment says what is true.

Emptying, not simply keeping, is the part that is easy to get wrong: the cascade used to do two
jobs at once, removing the row *and* its line items. Leaving those behind would hand the shopper
their basket twice the next time anything read that cart, so the guard clears the same three
tables `clearCart` does. The lookup costs two round trips and only on carts that have ever
reached checkout — the `checkoutIds` read short-circuits the `order.count` for an ordinary guest
cart, which has none.

**Option 3 is deliberately not taken.** The constraint is the correct answer and remains
available; what stops it today is that it needs a migration applied by hand against `DIRECT_URL`
on a live shop, and it converts a silent, harmless outcome into a failed sign-in. Worth doing
the next time a migration is being applied anyway, not on its own.

**Verify.** `services/cart-merge.test.ts` — three tests against the real database, checked to
FAIL against the pre-fix code rather than assumed to cover it (only the orphan test fails, which
is the one that should). Both directions are asserted: a guard that never deleted anything would
also pass a one-sided test while turning every sign-in into a leaked row.

The production invariant is reported by `npx tsx scripts/purge-e2e-data.ts`, which already holds
every ordered checkout id:

> `Orders whose checkout pointer resolves to nothing (BUG-004): 1 — expected 1, more means it happened again`

The existing dangling pointer is left alone. Repointing it would invent a checkout session that
never existed, and deleting the order would destroy a real EUR-value sale to make a count read
zero.

**Risk of change:** Low — the delete path is unchanged for every cart that has never been
ordered from, which is all of them but a handful.
**Fixed:** `34b5aa4`

**Observed working in production, 2026-09-05** — the standard this audit now holds itself to.
The same Playwright spec with **no settle**, run three times:

| Target | Result |
| --- | --- |
| Production, before deploy | ❌ cart empty |
| Local build with the fix | ✅ item added |
| Production, after deploy | ✅ item added |

The middle row proves the fix; the third proves it actually shipped. All 18 specs pass against
live production on desktop and mobile. The spec carries a comment saying that a reappearing
`waitForTimeout` above the click means the bug is back.

---

## [ ] OPS-001 · Three subsystems are deployed but have never been observed running

**Category:** Reliability / Operations
**Location:** `app/api/cron/data-retention/route.ts` · `services/audit-log.ts` · no uptime monitor
**Confidence:** Confirmed — measured against the production database, 2026-09-04

**Problem.** Phases 1–4 added machinery that is wired, type-checked, built and deployed, and
whose *only* evidence of working is that it compiles. That is precisely the state Sentry was
in yesterday, when it turned out to be reporting nothing at all because of a one-letter typo.
A clean build is not evidence of a running job.

**Evidence.** Queried against production:

| Subsystem | Expected | Actual |
|---|---|---|
| `data-retention` cron (03:30 daily) | rate-limit rows ≤ 2 days old | **1,639 rows older than 2 days**, oldest `2026-07-22` |
| `admin_audit_logs` | an entry per audited admin action | **0 rows** |
| uptime monitoring | an external prober | ~~none exists~~ → **live since 2026-09-05**, 5-minute interval, verified in the logs |

**Both zero results are currently explainable and neither is yet a bug.** The cron was
deployed today and first fires at 03:30 tomorrow; the audit log has only two call sites
(`users/actions.ts`, `payments/actions.ts`) and nobody has performed either action since
deploy. That is exactly what makes this worth writing down rather than assuming — the benign
explanation and the broken one look identical from here, and only the next run tells them
apart.

**Failure scenario.** `CRON_SECRET` is unset or differs from what Vercel sends. The route
correctly answers 401 and retention silently never happens — the safe failure, and the
invisible one. `rate_limit_attempts` and `payment_webhook_events` grow without bound, and the
GDPR position the PRIV-001 entry claims is not actually being honoured.

**Fix.**
1. After 03:30, re-run the row-age query below. Non-zero means the job did not run.
2. Confirm `CRON_SECRET` is set in Vercel (the other two crons already depend on it, so if
   they work, this one will too).
3. Perform one audited admin action and confirm a row lands in `/admin/activity`.

**Verify.**
```sql
SELECT COUNT(*) FROM rate_limit_attempts WHERE "createdAt" < now() - interval '2 days';
```
Expect `0` after the first successful run. Today it returns `1639`.

**Risk of change:** None — this is verification, not modification.

### CONFIRMED 2026-09-05 03:40 UTC — the cron did not run

The slot passed and **nothing changed**: still `1639` stale rows, still `2019` total, oldest
still `2026-07-22`. This is no longer "wired but unobserved". It is a live defect, and the
finding has done exactly the job it was opened to do.

What was established while diagnosing it, in order:

1. **The code is correct.** `runDataRetention` issues
   `deleteMany({ where: { createdAt: { lt: now - 2 days } } })`, which would have cleared all
   1,639 rows. Re-read rather than assumed, because "my own code is wrong" had to be excluded
   before blaming the platform.
2. **All three cron routes are deployed and correctly authorized.** Unauthenticated GETs to
   `/api/cron/data-retention`, `/api/cron/email-followups` and `/api/cron/instagram-token` all
   return **401**, not 404. The route exists and refuses properly.
3. **The Vercel team is on the `hobby` plan** — read from the Vercel API, not inferred. This
   is the same account whose image-transformation quota is already exhausted (`PERF-001`).

**Two candidate causes remain, and they produce identical evidence from the database side:**

| Cause | What you would see in Vercel |
|---|---|
| `CRON_SECRET` unset or mismatched | The cron **is listed** and its last run shows **401** |
| The job was never scheduled (plan cron limit — `vercel.json` declares **three** crons) | The cron is **not listed at all** |

*(The plan-limit possibility is recalled, not verified — it could not be confirmed from
Vercel's documentation search. Treat it as the hypothesis to test, not a finding.)*

Note also that Hobby-plan crons are triggered *approximately* rather than to the minute, so
being ten minutes past the slot is suggestive rather than conclusive on its own. What makes it
conclusive is the oldest row: **45 days old**. If this job had ever run successfully, it would
be gone.

**How to settle it in two minutes:**

```bash
vercel crons ls                              # is data-retention registered at all?
vercel crons run /api/cron/data-retention    # trigger it by hand
```

If the manual run clears the rows, the code and the secret are both fine and the problem is
purely scheduling. If it returns 401, it is `CRON_SECRET`.

**Consequence while this is unfixed:** the GDPR position `PRIV-001` describes **is not
actually being honoured**. Webhook payloads are not being blanked at 90 days and IP addresses
are not being purged at 2 days — the code to do both exists and has never executed. That is
the distinction this finding is about, and it is worth re-reading `PRIV-001` with that in mind.

### Half resolved, 2026-09-05 ~12:40 UTC

A manual trigger (`npx vercel crons run /api/cron/data-retention`) **worked**:

| | Before | After |
| --- | ---: | ---: |
| Rows older than 2 days | 1,639 | **0** |
| Total rate-limit rows | 2,019 | 317 |
| Oldest row | 2026-07-22 | 2026-09-03 |

Roughly 1,700 rows of IP addresses cleared. **`PRIV-001` is enforced as of now** rather than merely implemented.

It also eliminates one of the two hypotheses. `vercel crons run` invokes the route the way the scheduler does, with the `Authorization: Bearer` header, and it returned 200 and did the work — so **`CRON_SECRET` is set and correct**. The code is correct, the secret is correct, the route is deployed. What did not happen is the 03:30 trigger.

**Still open: whether the schedule fires on its own.** The next slot is the test. If it fires, this closes. If it does not, the cause is that the third cron is not being scheduled, and the fix is a code change rather than a setting — fold the retention work into one of the two existing cron routes so the project declares two jobs instead of three.

**Fixed:** _partially — the data is cleared and the job is proven to work; automatic scheduling is unproven until a slot fires unaided._

### The slot fired again and again did nothing — measured 2026-09-06 06:56 UTC

Queried production directly (host `ep-shiny-cake-…`, 6 orders — the live database, confirmed
by printing the host rather than trusting which `.env` was loaded):

| | |
| --- | ---: |
| Total rate-limit rows | 925 |
| Rows older than 2 days | **33** |
| Oldest row | **2026-09-04 02:03:02 UTC** |
| Newest row | 2026-09-05 21:41:20 UTC |

**This is conclusive, and it is worth being exact about why.** A row created at 02:03 on
4 September crosses the two-day retention threshold at **02:03 on 6 September** — an hour and
a half *before* the 03:30 slot. A run at 03:30 would have deleted it. It was still there at
06:56. The same holds for 32 other rows.

**A confound checked and dismissed.** `lib/rate-limit.ts` also prunes opportunistically, on
~1% of `recordAttempt` calls, deleting anything over a day old. That could not produce this
result: it only ever deletes *more*, so it cannot explain a row surviving.

**Both hypotheses from the table above are now dead.** `vercel crons ls` returns all three
jobs registered against the current deployment, `"enabled": true`, with nothing `undeployed`
or `modified` — so the plan-cron-limit guess is wrong, and it should never have been recorded
with as much weight as it was. `CRON_SECRET` was already cleared by the manual run, which
goes through the same authorization path the scheduler uses.

So the job is **correctly written, correctly deployed, correctly authorized, registered on the
schedule, enabled — and does not run.** Every explanation this investigation proposed has been
eliminated, which means the next step is not another database query; it is Vercel support or a
plan change, and until then the job needs a manual trigger to be considered enforced.

**The honest limit.** Hobby crons are triggered approximately, and 3.4 hours late is far
outside any reasonable jitter — but "far outside" is a judgement, not a proof. The remaining
possibility, that it fires much later in the day, is testable at no cost: the 33 rows above are
the marker. If they are gone tomorrow without anyone touching them, it runs late. If they are
still there, it does not run.

**Meanwhile `PRIV-001` is again not being honoured** — 33 rows of IP addresses are past their
stated retention right now. Small in volume, unchanged in principle.

### The marker test was invalid, and the third slot also failed — 2026-09-07 07:42 UTC

> **⚠ Superseded eight hours later. The "third slot failed" conclusion below is WRONG** — see
> the CORRECTION further down. The part about the marker test being invalid stands; the part
> that replaced it was invalid too, for two further reasons found the same afternoon.

**The 33 marker rows are gone. That proves nothing, and the test should not have been set.**

`lib/rate-limit.ts` prunes rate-limit rows older than **one day** on ~1% of `recordAttempt`
calls. The section above correctly dismissed that prune as an explanation for a row
*surviving* — it only ever deletes more — and then, three paragraphs later, used the
*disappearance* of those same rows as the discriminator. It cannot be one. Both "the cron ran
late" and "the opportunistic prune happened to fire" delete the markers, and they are the two
hypotheses the test was meant to separate.

**What settles it instead is a row that is still there.** Measured against production (host
`ep-shiny-cake-…`):

| | |
| --- | ---: |
| Total rate-limit rows | 1,218 |
| Rows older than 2 days | **198** |
| Oldest row | **2026-09-05 01:55:34 UTC** |
| Measured at | 2026-09-07 07:42 UTC |

A run at any point after ~01:56 today would have deleted that row — its two-day threshold
falls before the 03:30 slot, as it did for the 09-06 measurement. It is still there four
hours later. **Three consecutive slots have now passed without firing.**

**Three more explanations eliminated, two of which this file was still carrying:**

| Hypothesis | Verdict |
|---|---|
| Plan cron limit | **Dead, by documentation rather than inference.** Vercel's own usage page gives **100 cron jobs per project on every plan**, Hobby included. Hobby's only restrictions are once-per-day and per-hour precision (±59 min). The guess this file recorded on 09-05, flagged as recalled rather than verified, was simply wrong — three crons was never over any limit. |
| A cached response masking the run | **Dead by measurement.** Vercel's own cron troubleshooting guide lists response caching as a cause, and this app runs `cacheComponents: true`, which made it the best remaining candidate. Production answers `X-Vercel-Cache: MISS`, `Age: 0` — the function executes on every request. |
| Redeploys resetting the schedule | **Dead by measurement.** Deployments cluster around 07:00 and 21:00; nothing deployed between 21:52 on 09-06 and 06:49 on 09-07, so the 03:30 slot passed against a stable six-hour-old production deployment. |
| `proxy.ts` redirecting the request (crons do not follow redirects) | **Dead.** Its matcher covers `/admin`, `/account`, `/category`, `/products`, `/collections` and nothing under `/api`. |

So the 09-06 conclusion stands and is better evidenced than it was: correct, deployed,
authorized, registered, enabled, uncached, unredirected — and it does not run. **Next step is
still Vercel, not code.**

### CORRECTION — 2026-09-07 15:45 UTC. The scheduler works, and the last two "failures" were measurement artifacts

**Read this before the section above.** Everything it concludes about the 09-06 and 09-07
slots is wrong, for two independent reasons, and the finding is in a materially better place
than this file has been saying.

**Vercel's scheduler fires on this project.** The `email-followups` cron (`0 8 * * *`) has
sent abandoned-cart mail on five dated occasions, and every one lands inside its slot's hour:

| Sent (UTC) | |
|---|---|
| 2026-09-07 08:56 | four emails, this morning |
| 2026-08-24 08:57 | |
| 2026-08-20 08:03 | |
| 2026-08-19 08:32 | |
| 2026-07-31 08:56 | |

That is textbook Hobby behaviour — triggered within the hour, never to the minute. The other
dates are simply days it had no eligible cart and therefore left no trace, which is precisely
the blind spot the run log was built to fill. **"No cron on this project fires" is dead.**

**Defect 1 — the test cannot detect success.** A daily job that deletes rows older than two
days leaves, at any later moment, every row created between its last cutoff and two days ago.
That set grows all day and empties at the next run; its width is exactly the time since the
last run. **A non-zero count is the normal state of a job that is working.** So the two
measurements recorded above as proof of failure —

- 33 rows at 06:56 on 09-06, about three hours after a ~04:00 run, and
- 198 rows at 07:42 on 09-07, about four hours after one

— are the numbers a healthy job produces. The only valid test is whether rows predate the
*last pass's own cutoff*, which is what `npm run cron:status` now reports instead.

**Defect 2 — every timestamp this investigation printed was three hours early.**
`rate_limit_attempts."createdAt"` is `TIMESTAMP(3)` **without** time zone. node-postgres parses
such a column in the *client's* local zone, and this machine is Athens (UTC+3), so an ad-hoc
script displays every stored instant three hours before it happened. The session timezone is
`GMT`, so the SQL comparisons were correct throughout — only the printed instants were wrong,
which is the worst of both worlds: the counts looked trustworthy and the reasoning built on
top of them was not.

It flipped the 09-07 conclusion on its own. The oldest surviving row was reported as
`2026-09-05 01:55:34`; it is actually **04:55:34**. A run at 03:30 deletes rows older than
`09-05 03:30` (04:29 at the edge of Hobby's jitter), so a row from `09-05 04:55` is *newer
than the cutoff and is supposed to survive*. It was never evidence of anything. The same
correction applies to the 09-06 entry's `02:03` row, which is really `05:03`.

**What survives.** The original 09-05 finding was real and neither defect touches it: 1,639
rows with the oldest **45 days** old cannot be produced by a three-hour shift or by a job
running normally. The cron genuinely had never run, the manual trigger genuinely fixed it,
and `PRIV-001` genuinely was not being honoured until then.

**What is now unknown.** Whether `data-retention` has been running on its own since 09-05.
The evidence is *consistent* with it working and no longer shows it failing — but consistent
is not proven, and this finding has now been wrong in three different ways while feeling
certain each time (a marker test that could not discriminate, a steady-state count read as a
defect, and a timezone shift in the tooling). The run log settles it at the next slot, which
is why it was worth building.

**The lesson is not "be more careful."** All three defects share one shape: a measurement was
trusted because it was *numeric*, without asking what a passing result would have looked like.
None of them would have survived the question "what would I expect to see if this were
working?" — the marker rows would be gone either way, the overdue count is non-zero either
way, and the timestamps were never checked against a second source. That question belongs
next to this file's existing rule about `Fixed` meaning shipped.

### What shipped — 2026-09-07

Two things, and neither of them claims to fix Vercel.

**1. The three jobs now record their own runs** (`services/cron-runs.ts`). Each cron route
wraps its work in `runCron`, which writes when the run started, how long it took, whether it
succeeded, and — the part the database could never tell us — **what triggered it**, read from
the `x-vercel-cron-schedule` header Vercel sets and nothing outside can forge. `/api/health`
reports how many jobs are stale, so the uptime monitor that already probes it can assert on a
value.

This is the finding's own thesis applied to itself. OPS-001 was opened because a subsystem
nobody has watched run is not a subsystem known to work; the answer to that is not a fourth
round of reasoning backwards from row ages, it is a job that says what it did. Three days of
forensics — including a marker test that turned out not to discriminate — become one query.

Stored in `SiteContent` rather than a new table on purpose: this shop applies migrations by
hand against `DIRECT_URL`, nothing in the build runs `migrate deploy`, so a new table would
land the observability one manual step *after* the deploy that needs it.

**2. Retention no longer depends on the scheduler.** `runDataRetentionIfDue` runs the full
pass — rate-limit rows at two days, webhook payload bodies at ninety — when a day has gone by
with no recorded run, driven from ordinary request traffic in `recordAttempt`. The daily claim
is an atomic `INSERT … ON CONFLICT DO UPDATE … WHERE`, so concurrent requests cannot both take
the slot. The window is **25** hours rather than 24 so that a late-but-working scheduled run
always beats the fallback to it — otherwise the log would read `fallback` forever while the
cron quietly recovered, hiding the one fact this is all for.

That replaced the `Math.random() < 0.01` prune, which was failing for a measurable reason: on
a day this shop recorded 61 attempts, a 1-in-100 gate has an expected 0.6 firings. **The
cleanup was least likely to happen exactly when it was the only thing happening.** The new
gate is an in-process hourly timestamp, so it costs nothing per request and does not depend
on volume.

Pinned by `services/cron-runs.test.ts` (8 tests) on the two properties that fail invisibly:
the claim is atomic under four concurrent callers, and its timestamp is UTC — `site_content."updatedAt"`
is `TIMESTAMP(3)` **without** time zone, so a bare `now()` would convert through the server's
session timezone and skew the daily guard by hours with nothing to see anywhere.

**Scores are deliberately unchanged.** Reliability stays at 88. It was lowered on 09-06 with
the reasoning that "a job that only works when a human remembers to trigger it is not a
reliability feature" — that specific objection is now answered, since no human is required.
But this file's standing rule is that `Fixed` means the code shipped, not that the thing
works, and none of the above has yet been observed running in production. Raising a score on
a deploy is precisely the error the rule exists to prevent.

**Still open, and what closes it.** Query the run log after the next slot:

```sql
SELECT data->'lastRun'->>'at'      AS last_run,
       data->'lastRun'->>'trigger' AS trigger
FROM site_content WHERE key = 'cron:data-retention';
```

- `trigger = 'schedule'` → Vercel's scheduler is alive; this closes.
- `trigger = 'fallback'` → retention is being honoured, the scheduler is still dead, and the
  evidence to take to Vercel support is now a dated record rather than an inference.
- No row at all → the fallback is not being reached either, which would be a new finding.

### RESOLVED IN SUBSTANCE — 2026-09-08 09:05 UTC. All three jobs observed on the scheduler

The finding's own words were "three subsystems are deployed but have never been observed
running." All three have now been observed running, on Vercel's scheduler rather than the
fallback, under a run log that records what triggered each one:

```
ok  data-retention    2026-09-08 03:49:37Z   trigger: schedule
ok  email-followups   2026-09-08 08:56:47Z   trigger: schedule
ok  instagram-token   2026-09-08 04:12:10Z   trigger: schedule
```

Retention is doing its job as well as running: **0 rows older than the last pass's own
cutoff**, which is the only count that can prove a pass failed. The 210 rows older than two
days are the normal steady state between daily passes — the exact number this finding spent
three days misreading as evidence of failure.

**`email-followups` fired at 08:56:47Z, 56 minutes into its 08:00 slot.** That is worth
recording because at 08:25 it still read `never`, and the temptation was to call it broken.
Hobby's scheduling precision is ±59 minutes, so its slot had not closed; declaring failure
then would have been the same error as the three that opened this finding, in the opposite
direction. The rule earned above — *ask what a passing result would look like* — has a
corollary: **ask whether a failing result was even possible yet.** A slot that has not elapsed
under observation is unmeasured, not failed. `scripts/cron-status.ts` now says so in its own
verdict, and names every job rather than only retention.

**Still open by one confirmation.** `data-retention` has exactly one scheduled day on record.
One run after three failed slots is as easily a coincidence as a recovery, so this stays open
until it fires a second consecutive night — the 03:30 UTC slot on 9 September. The script asks
for that itself and stops asking once it sees two dated days.

The audit-log leg is unchanged and still open for its original benign-or-broken reason:
`admin_audit_logs` holds 0 rows because no audited admin action has been performed since
`OBS-003` widened the coverage. One audited action settles it.

**The audit-log leg of this finding is also still open**, and for the original reason rather
than a new one: `recordAdminAction` is now wired at 21 call sites across 10 admin surfaces
(`OBS-003`), and `admin_audit_logs` still holds **0 rows** — because no audited admin action
has been performed since it was widened, not because anything is known to be broken. That is
the same benign-or-broken ambiguity this finding was opened about, and it is resolved the same
way: perform one audited action and confirm the row appears in `/admin/activity`.

---

## What shipped — 2026-09-08

Eighteen commits, and unusually for this audit **most of them are not remediation**. The shop
was already ready to launch; this is the day it started being shaped by someone using it. Ten
of the eighteen came from the owner looking at a screen and saying what was wrong with it,
which is the same source that produced `PERF-004` and remains the one no audit pass replaces.

Recorded here because three of them were defects a reader of this file would want to know
about, and two of them changed money or data.

### Two money-or-data defects found by using the shop

**Gift wrap could be charged with no way to remove it.** The checkbox was taken out of the
delivery step when the merchant retired the service, and the note left behind said nothing set
the flag any more. That was true of the checkout steps and false of the system:
`PATCH /api/checkout/[checkoutId]` went on accepting `giftWrap`. So a checkout could carry a
fee that no screen on the site could take back off — shown in the summary, charged at order
creation, uncancellable by the shopper. It surfaced on **the merchant's own cart**, a real
checkout from 2026-08-29 that had been quietly holding the charge. The route no longer accepts
the field; `scripts/clear-gift-wrap.ts` cleared the one live row and deliberately left the two
completed orders alone, because those were charged and delivered with wrapping and rewriting
them would be falsifying a receipt. (`1779ad8`)

**A stored shipping rate was never re-priced when the address changed.** The chosen rate is
written onto the checkout with its price baked in, and every later step reads the charge back
from there. Nothing re-examined it when the address moved, so a shopper could pick a rate in
Athens, change the delivery address to a remote postal code or to Portugal, and keep the
Athens price — and the order would be placed at it. `updateShippingAddress` now re-resolves the
stored rate, re-pricing it or clearing it when the new destination cannot use it at all.
Verified by PATCHing the Greek rate onto a Portuguese checkout and getting the EU rate back.
(`0a55c23`)

### The Greek shop was still speaking English in three places

Each was invisible to `tsc`, `eslint` and 526 tests, and each was found by looking at the page.

- **Checkout validation errors.** A fully Greek form answered ΟΝΟΜΑ with "First name is
  required". The strings were inline in the Zod schemas, which are shared by the client forms
  and the API routes, so there was nowhere for a translation to enter. Each schema is now a
  factory taking a message resolver; `useTranslations("Validation")` already has that exact
  signature. The bare exports keep English defaults on purpose — a JSON error body is read by
  developers, and `storedAddressSchema` takes no resolver at all, because failing to parse an
  address the shop already wrote is a bug report rather than a prompt. This also fixed the
  mirror-image bug: the τιμολόγιο messages were hardcoded *Greek*. (`e088301`)
- **Payment methods.** "Cash on Delivery" and "Bank Transfer" came from `defaultDisplayName` on
  the provider definitions, which the database overrides only when an admin sets them, and
  nobody had. Now Αντικαταβολή and Άμεση τραπεζική μεταφορά, the latter saying what a Greek
  customer actually needs — IBAN, the order number as αιτιολογία, and when it ships. Five more
  hardcoded English strings on the same step went with them. (`53bdcf2`)
- **Delivery labels.** These live in the `site_content` row, not in `data/shipping.json` — the
  JSON is only the fallback for a fresh install, so editing it alone changes nothing a customer
  sees. Both updated through `scripts/update-shipping-copy.ts`, which edits one rate in place
  so the 488 remote postal codes beside it survive. (`56a1ee5`)

### Two features, and the one bug worth reading about

**ΑΦΜ autofill** (`lib/tax-registry.ts`). Typing a VAT number at checkout fills Επωνυμία, ΔΟΥ
and δραστηριότητα from AADE's RgWsPublic2 registry. The checksum runs before the network call,
which rejects most mistyped input for free and keeps a wrong number from reaching a government
API that logs every call against this shop's account.

**It shipped broken, and how it broke is the point.** Every call in production returned
`SOAPMessage request format error - java.lang.NullPointerException`. The cause was
`<as_on_date/>` — a self-closing empty element for an optional `xsd:date` the shop has no value
for. AADE's parser does not read that as absent; it tries to parse `""` as a date and throws.

The request had been derived from AADE's own published schema, and *that felt like
verification*. It is not. **A schema says what is allowed; only the live service says what its
parser survives.** The response parsing had tests and the request had none, because the request
looked like the half that could not be wrong. It now has its own regression tests.

The diagnosis technique is worth keeping: a malformed envelope returns that format error, while
a well-formed one returns `RG_WS_PUBLIC_TOKEN_USERNAME_NOT_AUTHENTICATED`. So **deliberately
wrong credentials are enough to verify request shape** — getting the auth error is the proof,
and no real credentials are needed. (`8d34908`, `39e4dbb`)

**Customer delivery notes** (`f9feb48`). A textarea on the review step; the note travels onto
the order and shows outlined at the top of the admin order page. The only new migration in this
audit's history, and additive and nullable so it was safe to apply *before* the code deployed —
the running build simply never selected the columns. Not folded into the unused `giftMessage`
column, which stays reserved so gift wrapping is a UI change in December rather than a rebuild.
Tested where it can silently fail: the checkout-to-order hand-off, since a note saved perfectly
and then not copied across looks fine to the shopper and reaches nobody.

### A fix that was reverted before it was fixed

A toast raised while the cart drawer is open lands on the drawer's checkout button — and for
the remove-from-cart toast, the undo it offers is the thing being covered. The first attempt
used a Tailwind `sm:pr-[29rem]` utility and **did not work**: a probe element with a
byte-identical class list computed 464px while the real viewport stayed at 16px, and the
difference was never explained. It was reverted rather than shipped with a comment claiming a
fix it did not deliver, and the case was reported honestly as still broken.

The second attempt is a plain rule in `globals.css` keyed off a data attribute, outside
`@layer`, where its specificity is not in question. Verified by measurement rather than by
reading: the toast's right edge sits at 448px against a drawer starting at 528px. (`2f02600`)

**The rule this leaves behind:** an unexplained fix is not a fix. Reverting and saying so cost
one exchange; shipping it would have left a comment in the codebase asserting something untrue.

### Late on the same day: the cheapest possible pass found the most expensive thing

A question about whether a different model would find different bugs was answered by running
`knip` instead — a dead-code pass that needs no model at all. It reported 146 lines. Five
mattered, and one of them was `PRIV-002` having no caller (above). The rest:

**A documented invariant with nothing behind it.** `lib/password.ts` exported `BCRYPT_ROUNDS`
under a comment promising it was shared *"so a future increase moves the dummy hash below with
it"*. It was shared by nobody. Six call sites each held their own copy — a second
`BCRYPT_ROUNDS` in the admin user actions, a `BCRYPT_COST` in the sign-up route, a bare `12` in
change-password, reset-password and the seed. All five read 12, so nothing was broken; what was
broken is the mechanism. **Two separate timing defences depend on that number matching.**
`verifyPassword` compares against a dummy hash so a missing account costs the same as a present
one (`AUTH-002`), and the sign-up route burns an equivalent hash on the already-registered
branch for the same reason. Raising the work factor in one place — the obvious thing to do, and
the thing the comment invited — would have silently ended both, with no test and no type error
to say so. Every hash now goes through `hashPassword` and the constant is private. (`96680c6`)

**A dependency that resolved only by luck.** `prisma.config.ts` imports `@prisma/config`, which
was never declared in `package.json` and arrives transitively under `prisma`. A version bump
that stops hoisting it breaks `prisma generate` on a clean install — and Vercel installs clean,
so the first symptom would have been a failed deploy with nothing in the diff to explain it.
Also removed `@types/bcryptjs`, a v2-era stub shadowing the types bcryptjs 3.x ships itself, and
untracked `.image-migration-2026-09-06/`, whose rollback map had been committed. (`9dc3906`)

**The tool is only useful configured.** Run bare it called all 34 one-off scripts in `scripts/`
dead — they are deliberate CLI tools with no importer — and that cascade then reported `sharp`
as an unused dependency, because the only file using it had just been declared a corpse. With
entries declared the report went 146 lines to 95, and 36 "unused files" to the one real one.
An unconfigured tool that cries wolf about 35 things gets ignored on the 36th, which is the one
that mattered here. `knip.json` is committed so the next run starts honest.

**What this says about the audit's method.** This file already carries the rule that a clean
read is not a clean run, learned from findings that only appeared under traffic. `knip` is the
opposite lesson and does not contradict it: **a static pass finds a different class of defect
than exercising the shop, and neither substitutes for the other.** Nothing in this section would
have been found by clicking through the site — an unwired action renders no page, a duplicated
constant behaves correctly, a transitively-resolved import works until it doesn't. And nothing
`knip` reports would have caught the gift-wrap charge, the un-repriced shipping rate, or the
AADE empty element. The cheap deterministic pass should have been running from day one; it costs
nothing and it was never run.

---

## [x] OBS-003 · The admin audit log covers 2 of ~12 admin surfaces

**Category:** Observability / Operations
**Location:** `recordAdminAction` called only from `app/admin/(dashboard)/users/actions.ts` and `app/admin/(dashboard)/payments/actions.ts`
**Confidence:** Confirmed

**Problem.** OBS-002 delivered the audit-log mechanism and wired it to admin-user and payment
actions — the two highest-risk surfaces, which was the right place to start. But the admin can
also delete reviews, edit and delete products, change shipping and payment settings, issue
discounts and gift cards, and none of those leave a trace.

**Failure scenario.** A product's price is wrong, or a customer's genuine 1-star review has
vanished. There is no way to establish who changed what or when — including for the merchant's
own benefit, if a second person is ever given admin access.

Review deletion is the sharpest case: it was added at the merchant's request and is
irreversible, and unaudited deletion of customer-authored content is the kind of thing a
consumer-protection complaint asks about directly.

**Fix.** Add `recordAdminAction` to the remaining mutating admin actions. The function already
resolves the actor from the session and is written never to throw, so each call site is one
line and cannot break the action it records.

**Verify.** Delete a review; confirm the entry appears in `/admin/activity`.

**Risk of change:** Low — additive, and the helper already swallows its own failures.
**Fixed:** `12502bc` — widened from 2 surfaces to 8: orders, returns, gift cards, discounts, products, reviews, settings, admin users.

What earns an entry is deliberate rather than "every mutation": money, permissions, an order altered after payment, or **something destroyed that cannot be reconstructed from the row that remains**. That last clause decides the near misses — approving or rejecting a review is absent because the row carries its own status, while deleting one is present because nothing is left to read; `product.created` is absent because a product that exists is its own evidence, while `product.updated` is present because an overwritten price is not.

Two things fell out of the work. **`order.status_changed` had been declared in the vocabulary since OBS-002 and was never written by anything** — the verb existed, the record did not. And `/admin/activity`'s filter listed only the three original prefixes, so entries under any new one would have been recorded and then unfindable; the filter now lists all nine.

Every capture of prior state happens *before* the write, for one reason: afterwards there is nothing left to describe, and an entry reading "a review was deleted" answers none of the questions actually asked of it.

---

## [x] PRIV-002 · No way to answer a GDPR access or erasure request

**Category:** Privacy / Compliance
**Location:** repo-wide — no account deletion, no data export, no admin tooling
**Confidence:** Confirmed — searched for it specifically and it does not exist
**Found:** 2026-09-05, by hunting for what the audit's own dimensions could not see

**Problem.** `PRIV-001` treated GDPR as a *retention* problem and solved that. But
retention is one obligation among several, and the two most likely to actually arrive as a
request from a person are absent: **Article 15** (a copy of their data) and **Article 17**
(erasure).

The privacy policy already tells customers to email to exercise these rights, which is
lawful — a manual process satisfies GDPR provided it is honoured. What does not exist is any
way to *carry it out*.

**Failure scenario.** A customer asks to be deleted. Fulfilling it by hand means working
across `customers`, `customer_addresses`, `carts`, `wishlists`,
`product_reviews` and `orders` — while *not* deleting the order records Greek tax
law requires be kept for years. That tension, under a 30-day clock, on a live database, by
hand, is where a mistake becomes either a compliance breach or lost accounting records.

**Why the audit missed it.** Not an oversight in reading — a gap in the instrument. All ten
scoring dimensions are engineering (Security, Correctness, Reliability, Performance, Testing,
Maintainability, Observability, Deployment, Accessibility, SEO). **There is no axis for
compliance**, so an obligation with no code behind it could not lower any number and never
surfaced. Worth remembering when reading the scores: they measure what they measure.

**Fix.** Two admin actions behind `admin:settings`:
- **Export** — assemble everything keyed to a customer into one JSON download.
- **Erase** — anonymise rather than delete: null the personal fields on the customer and its
  addresses, drop carts, wishlists and reviews, and leave orders in place with the identity
  scrubbed. That satisfies erasure while preserving the transaction record tax law wants.

Both should write to the admin audit log (`OBS-003`), because "we honoured the request
on this date" is exactly the kind of thing you need to be able to show.

**Verify.** Run an export for a test customer on the Neon branch and read it. Run an erasure
and confirm the orders survive with the identity removed.

**Risk of change:** Medium — it deletes customer data by design, so it wants the test branch
and a careful read before it ever runs against production.

**Fixed:** `services/data-subject.ts` plus two admin actions behind `admin:settings`, both recorded to the audit log under the new `dataSubject.*` verbs.

**Erasure is anonymisation where the law requires the record kept.** Orders are *not* deleted: Greek tax law requires transaction records be retained, and GDPR Art. 17(3)(b) exempts processing required by a legal obligation. So the order survives with its line items, totals, dates and status intact — the accounting facts — while every identifying field is overwritten, including the address inside the JSON snapshot, which is replaced wholesale rather than patched so no street name survives. Everything with no such obligation behind it (addresses, carts, wishlists, reviews, newsletter, contact and concierge messages, OAuth links, the customer row itself) is deleted outright. One transaction: a half-erased customer is worse than a failed request, because nobody can tell by looking which half succeeded.

### It was closed for three days without a caller (2026-09-08)

The service, both actions, the capability gate, the audit-log entries and seven passing tests
all landed on 5 September. Nothing imported the actions. There was no button, no form, no route
— so the finding's own headline, *no way to answer a GDPR access or erasure request*, remained
literally true while this file listed it as fixed.

Found by `knip`, which reported `app/admin/(dashboard)/customers/actions.ts` as an unused file.
Not found by `tsc`, `eslint`, the seven tests, or four days of reading this document.

Three things are worth taking from it.

**Tests are not reachability.** The seven tests import the service and call it directly, which
is the right way to test erasure and says nothing about whether a person can invoke it. Every
one of them would have gone on passing for as long as the feature existed unwired.

**A "fix" made of parts is not finished when the parts exist.** Each piece was individually
complete and correctly built. Nothing in the review of any single piece would reveal that the
last edge of the graph was missing, because that edge lives in a file none of them mention.

**This is precisely the failure the standing rule names**, arrived at from the other direction.
The rule was written after a cron that had never fired: `Fixed` means shipped, not working. Here
the code shipped and still did not work, and the same sentence covers it — with the corollary
that the cheapest check is often the dumbest one. A dead-code pass that costs nothing found in
seconds what careful reading had missed for three days.

**Wired:** `663b22a` — two forms on `/admin/customers`, gated on `admin:settings`, working from
an email address rather than a table row so guests, newsletter subscribers and contact-form
senders are reachable too; `findDataSubject` always searched all of them, and a per-row button
could only have asked about people who have accounts.

**Guest data is followed by email, not just by foreign key.** Reviews, newsletter subscriptions and contact messages are keyed by email alone — written by people who never made an account. An erasure that followed only `customerId` would tell someone "we hold nothing about you" while their name sat on a product page.

**Two deliberate refusals.** The action requires the email typed a second time before it will run, the same protection a repository host asks for before deleting a repo and for the same reason. And the audit entry masks the address to `m***@gmail.com`: a log that records it in full is a second copy of the thing the person just asked you to delete.

**Verified** by 7 tests on the Neon branch — including the assertion that matters most, which is not "did it delete" but that the order is still there afterwards, still `confirmed`, still carrying its totals and line items, and containing neither the name nor the street.

---

## [x] REL-001 · No timeouts on payment or courier provider calls

**Category:** Reliability
**Location:** `lib/payments/providers/*`, courier integrations — only `services/instagram.ts` sets `AbortSignal.timeout`
**Confidence:** Confirmed

**Problem.** `services/instagram.ts` correctly bounds its outbound call. The payment and
courier providers do not, so a provider that accepts a connection and then stalls holds the
checkout request open until the platform kills it.

**Failure scenario.** The provider has a bad day and responds in 45s instead of 300ms. Every
checkout request occupies a serverless invocation for the full duration; concurrent shoppers
queue behind exhausted capacity. The shop appears down while every component of it is healthy.
This is the failure that turns a supplier's incident into your incident.

**Fix.** `AbortSignal.timeout(8000)` on outbound provider `fetch` calls, following the pattern
already in `services/instagram.ts`, and map the abort to the existing `PaymentError` handling
so it surfaces as a clean failure rather than a crash.

**Verify.** Point a provider at a deliberately stalling endpoint; confirm the request fails
fast with a handled error rather than hanging.

**Risk of change:** Low — but it touches the payment path, so it wants its own commit and a
careful read, not a drive-by.
**Fixed:** `2f5f0b6` — every outbound provider call is now bounded. The ceilings differ because the consequences do:

| Provider | Limit | Why that number |
|---|---:|---|
| Stripe | 15s | Card authorization is genuinely slow under load; a tight limit would abandon payments about to succeed. What this bounds is the pathological case, not slowness. |
| ACS courier | 10s | Nothing a shopper waits on — a voucher is created after the order exists, so failing fast delays a label, not a purchase. |
| OAuth | 8s | A small token round trip with no money attached, and an unredeemed authorization code simply expires. |

**The Stripe case has a precondition worth stating plainly:** aborting does *not* cancel the operation at Stripe, so a timed-out `POST` may well have created the PaymentIntent. This is only safe because every write carries an `Idempotency-Key` — a retry replays the original response rather than charging twice. **Timing out a write without that key would risk a double charge.** The ACS path has no equivalent, so its error tells the operator to check the portal before retrying rather than implying nothing happened.

Scope was widened beyond the finding's title: the three OAuth providers have the identical defect, and leaving a known-identical hole open because the heading said "payment or courier" would be arbitrary. They share `lib/oauth/fetch.ts` rather than repeating the same try/catch four times.

Every path distinguishes a timeout from a DNS/TLS fault, because they have different fixes and a log line that conflates them sends the reader to the wrong place. Pinned by `lib/oauth/fetch.test.ts` — a timeout's whole value lies on a path that never runs normally, so without a test its only evidence of working is that it compiles, which is the exact condition `OPS-001` was opened about.

---

# P3 — Low

## [x] A11Y-001 · No skip-to-content link
WCAG 2.4.1 (Bypass Blocks), Level A. Keyboard users must tab through the full header on every page. ARIA is otherwise good — 99 `aria-invalid`, 91 `aria-label`, 26 `aria-describedby`, `aria-modal` on dialogs.
**Fix.** Visually-hidden anchor to `#main` as the first focusable element in `app/layout.tsx`.
**Fixed:** Phase 4 — skip link in `app/layout.tsx` as the first focusable element, with `id="main"` added to all 33 `<main>` elements. Visually hidden until focused rather than hidden outright, so a sighted keyboard user can see where focus went. Verified in the browser: first focusable, visible on focus, target present.

**Now pinned by a browser test**, because "in the DOM" and "actually reachable and visible on focus" are different claims and only one of them is what WCAG 2.4.1 asks for.

## [x] A11Y-002 · Colour swatches were invisible to screen readers

**Category:** Accessibility
**Location:** `components/product/ColorSwatches.tsx`
**Confidence:** Confirmed — `aria-prohibited-attr`, **serious**, on the homepage, every product page and every category listing
**Found:** 2026-09-05, by the axe scan on its first run

**Problem.** The swatch was a bare `<span>` carrying `aria-label={color.name}`. ARIA **prohibits**
`aria-label` on a generic element, so assistive technology discards it outright — the swatch
announced as nothing at all.

On a product card the swatch is the *only* thing conveying colour: the name appears nowhere
else. So a screen-reader user browsing the catalogue could not tell a black loafer from a brown
one, on a shop that sells the same shoe in several colours.

**Fix.** `role="img"` on the span, which is a role that accepts a name — and an honest
description of what it is: a block of colour standing in for a word. The other two swatch call
sites (`VariantSelector`, `QuickViewDialog`) were already on real `<button>` elements, which
permit the attribute, so only this one was wrong.

**Verify.** The axe scan over the homepage, a product page, a category listing, the empty and
filled cart, and the checkout contact step. Zero violations at WCAG 2.1 A and AA.

**Risk of change:** None — one attribute.
**Fixed:** `role="img"`, verified by the scan that found it.

## [x] DEP-001 · `prisma` CLI ships in production dependencies
`package.json` lists `prisma` under `dependencies` (needed for `postinstall: prisma generate`). Vercel installs devDependencies at build time, so it can move — this also removes the `mysql2` and `fast-uri` advisories from the deployed tree.
**Fix.** Move to `devDependencies`; confirm the Vercel build still generates the client.
**Risk:** Build-breaking if Vercel's install step changes. Verify on a preview deploy first.
**Fixed:** Phase 4 — moved to `devDependencies`; build and `prisma generate` verified. Note the `npm audit` count does **not** drop: `@prisma/client` declares `prisma` as an *optional peer*, so npm keeps it in the production graph regardless. The move is correct hygiene and declares intent, but the advisories below were always the real answer.

## [x] DEP-002 · 4 advisories, all dev/build-only
`mysql2` (high), `fast-uri` (high), `qs` (moderate), `prisma` (moderate). **Traced: all reachable only via the `prisma` CLI and `shadcn`.** The app uses `@prisma/client` + `@prisma/adapter-pg` at runtime and never loads these. **Not a launch blocker.** Largely resolved by DEP-001.
**Fixed (assessed, no action needed):** Phase 4 — re-confirmed all four advisories are reachable only through the `prisma` CLI and `shadcn`, neither of which is loaded by the deployed serverless runtime (the app uses `@prisma/client` + `@prisma/adapter-pg`). `npm audit fix --force` would DOWNGRADE Prisma to 6.x, a breaking change and a worse outcome than the advisories. Left as-is, deliberately.

## [-] PERF-002 · Nothing is statically rendered, so every page is a server render

**Category:** Performance / Architecture
**Location:** `app/layout.tsx` → `getLocale()` → `i18n/request.ts` → `cookies()`
**Confidence:** Confirmed — measured against production and against the build output
**Found:** 2026-09-05, by asking why Performance was the lowest score and measuring instead of repeating the existing answer

**Problem.** The audit has carried Performance at 72–74 since the start and attributed it
entirely to `PERF-001`, image optimization being off. That is real but second. The larger
cost had never been measured:

| Measured on production | |
| --- | --- |
| TTFB, cold | **4.2s** |
| TTFB, warm | ~1.0s |
| Homepage HTML | 277 KB |
| Images on the homepage | 30, from 24 KB to 234 KB (~3 MB) |
| `Cache-Control` | `private, no-cache, no-store, must-revalidate` |
| `X-Vercel-Cache` | **MISS** |
| **Pages prerendered at build** | **zero of 148 routes** |

The only static entries in the build are `robots.txt`, `sitemap.xml`, `icon.svg`, the
manifest and the OG image. **Not one page.** Every visit to every product page is a serverless
invocation running database queries, with nothing cached at the edge.

**Cause.** `app/layout.tsx` calls `getLocale()`, which reads `cookies()` inside
`i18n/request.ts`. Reading a request cookie in the **root layout** opts the entire
application out of static rendering — Next cannot prerender a page whose output depends on a
request header.

The i18n decision itself is sound and well argued in `i18n/config.ts`: cookie-based locale,
no `/el/` prefix, because every product, category and legal page exists only in Greek and
English is ~90 chrome strings. What is nowhere written down is its cost. **The rendering model
of the whole site is a side effect of a localisation choice**, and nobody chose it.

**Consequences beyond speed.** Every page view is a function invocation on an account already
brushing its limits — the same account whose image-transform quota ran out and caused
`PERF-001`. Those are separate quotas, so this is not the direct cause, but both are
pressured by the same thing: nothing is cached, so everything is computed.

**This also corrects `SEC-003`.** The decisive argument for deferring the CSP nonce was that
it "forces every page to render dynamically, disabling static generation and CDN caching."
That consequence had **already happened**, months earlier, for an unrelated reason. The
argument was sound in general and wrong about this shop, and it was asserted without checking.
See the correction in that entry.

**Fix — two tiers.**

1. **Cheap and safe.** The root layout runs `getSeoDefaults()` and `getAllCategories()` on
   every render of every page. Both change rarely. Caching them cuts real database time off
   every request without touching the rendering model.
2. **The real fix: Cache Components.** Next 16 ships `cacheComponents: true` with the
   `use cache` directive, whose default behaviour is Partial Prerendering — a static shell
   served from the CDN, with genuinely request-dependent parts streaming behind `<Suspense>`.
   That keeps the cookie-based locale exactly as it is while returning most of every page to
   the edge. Next validates this explicitly: it names any component that cannot prerender and
   points at the fix.

**Verify.** `next build` should report pages as prerendered rather than 148 dynamic routes,
and production should answer with `X-Vercel-Cache: HIT` and a TTFB in tens of milliseconds
rather than ~1s.

**Risk of change:** **Medium-high, and it is the rendering model of a live shop.** Tier 1 is
low risk and can be done on its own. Tier 2 changes how every page is produced and deserves
its own session, its own commit, and the browser suite run against it before and after — not
a quick edit at the end of a long day.
### Tier 1 done, and it did NOT help TTFB — 2026-09-05

`92cf413` cached both root-layout queries with tag invalidation on write. Then measured, and
the honest answer is that it changed nothing a visitor would feel:

| Warm TTFB | Before | After |
| --- | --- | --- |
| Homepage | 0.89–1.05s | 0.93–1.13s |
| Product page | — | ~1.02s |

Identical within noise. Two database round trips were **not** the bottleneck; they were perhaps
50–100ms of a second. What costs the second is the serverless invocation plus React rendering
a large page plus the rest of the page's own data fetching — none of which caching two layout
queries touches.

**Keep it anyway**, for reasons that are real but invisible in this number: it removes two
queries per page view from Neon on a free-tier database, and it is a prerequisite for tier 2
rather than an alternative to it. But nobody should read tier 1 as having addressed
`PERF-002`.

**The value is all in tier 2.** Only a static shell served from the CDN turns ~1s into tens of
milliseconds, because only that removes the render from the request path entirely.

Recording this because the tempting version of this entry says "tier 1 complete" and moves on,
and the next person would reasonably assume performance had been improved. It has not been.

### Tier 2 attempted and reverted — 2026-09-05

Enabled `cacheComponents: true` and let the build report the real scope rather than guessing
at it. Two things came back.

**The trivial one.** `app/api/health/route.ts` exports `dynamic = "force-dynamic"`, which
Cache Components rejects outright — every route is dynamic by default now, so the export is
simply deleted. One line.

**The real one.** The build then fails prerendering `/products/[slug]`:

> Next.js encountered uncached or runtime data during prerendering. `cookies()`, `headers()`,
> `params`, `searchParams` accessed outside of `<Suspense>` prevents the route from being
> prerendered.

**And the structural obstacle underneath it.** The fix Next prescribes is to move runtime data
access inside a `<Suspense>` boundary. That works for a dashboard widget. It does not work for
this app's locale, because `getLocale()` feeds two things that cannot go behind Suspense:
`<html lang={locale}>` and the `NextIntlClientProvider` that wraps the entire tree. **A
static shell needs to know its language before it can render, and next-intl's cookie-based mode
only knows it at request time.**

So tier 2 is not "add Suspense boundaries". It is a decision about localisation:

| Option | Cost |
| --- | --- |
| Render the shell in Greek always, swap English chrome client-side | English visitors see Greek chrome for one paint. Crawlers get Greek, which `i18n/config.ts` already argues is what should be indexed. |
| Locale-prefixed routing (`app/[locale]/`) | The approach `i18n/request.ts` already names as correct *once content is translated*. Today it creates two near-duplicate URL sets, which that comment warns costs rankings. |

Then, separately, every page's own data access needs `use cache` or a Suspense boundary —
across 148 routes.

**Reverted rather than left half-done.** The build is green and the working tree is clean. A
partially migrated rendering model on a live shop is worse than an unmigrated one, and this is
a multi-session refactor touching i18n, every page's data fetching, and the metadata layer.

**The sanctioned path, when it is taken.** Next ships an adoption skill for exactly this
migration, and its incremental mode is the shape this shop needs — opt every route out of
validation in one mechanical change, then convert one feature at a time:

```bash
npx skills add vercel/next.js --skill next-cache-components-adoption
```

### Tier 2 pre-step landed — 2026-09-05, `34629b3`

The earlier attempt was reverted because enabling Cache Components appeared to demand fixing
all 148 routes at once. It does not. Next ships an opt-out, `export const instant = false`,
which lets the flag go on while every route stays exactly as it was — so the foundation can
land in one reviewable change and the actual adoption can proceed feature by feature.

**Nothing is faster yet, and that is deliberate.** No page changed how it renders.

| What landed | |
| --- | --- |
| `cacheComponents: true` | Partial Prerendering becomes the default |
| 82 pages and layouts | `export const instant = false` + a `TODO: Cache Components adoption` marker |
| Two sync-IO blockers | Fixed — see below |
| Build · tests · lint | Passing · 455 · clean |

**The TODO markers are the work queue.** Opt-outs resolve top-down and the highest one wins, so
they come off root-first: removing a leaf's opt-out does nothing while an ancestor still holds
one.

**The two blockers an opt-out cannot suppress**, both sync-IO at render time, fixed differently
because they are different problems:

- **`Footer`'s copyright year** — now cached with a days-long life. It is the same number for
  every visitor, changing once a year, and the Footer is rendered by the root layout, so this
  single `new Date()` was blocking **every route in the app**. A day of staleness on
  1 January is the entire downside.
- **The new-blog-post page** — now `await connection()` instead. Its date field is "today",
  prefilled for a post being written now. Caching it would quietly hand the editor yesterday's
  date, which is the kind of wrong nobody notices until something is published under it.

**Already visible:** eight admin detail routes report as `◐ Partial Prerender` — the mechanism
working before a single route has been adopted.

**Checked every build from here on:** `/api/health` must stay `ƒ` dynamic. A prerendered
health check answers "healthy" forever, including while the database is unreachable, which is
the one failure it exists to report.

**What remains, and it is still a product decision first.** The first real adoption is the root
layout, and it runs straight into the locale: `getLocale()` feeds `<html lang>` and the
i18n provider, neither of which can sit behind `<Suspense>`. Either the shell renders Greek
always with English chrome swapped client-side, or the app moves to locale-prefixed routing.
No tool decides that.


### Re-measured 2026-09-06: the pre-step was NOT a no-op — it was most of the fix

This entry said, twice and emphatically, that nothing was faster yet and that this was
deliberate. **That was an assumption, and production disagrees.** It was never re-measured
after `34629b3` deployed; the claim was reasoned from "every route is opted out" and written
down as though it were an observation.

| Homepage TTFB | Recorded 2026-09-05 | Measured 2026-09-06 |
| --- | ---: | ---: |
| Warm | 0.89–1.13s | **0.20–0.42s** |

Roughly **three to five times faster**, on the same site, measured the same way from the same
machine.

**The first figure recorded here was 0.17–0.24s, and that was the flattering end of it.** A
wider sample taken later the same day, after the WebP migration and a fresh deploy, spread
**0.20–0.42s**, with one 0.81s outlier while Neon was waking (the health check reported 949ms
database latency in the same second). The conclusion is unchanged and the score stands — but
the range was narrower than the evidence supported, which is exactly the error this document
keeps catching in itself.

**The response headers say what changed:**

| | Before | After |
| --- | --- | --- |
| `Cache-Control` | `private, no-cache, no-store, must-revalidate` | `public, max-age=0, must-revalidate` |
| `X-Vercel-Cache` | `MISS` | `PRERENDER` / `HIT` |

**`no-store` was the whole problem.** While it was present, no response could be held at the
edge, so every visit paid for a full serverless render. Enabling Cache Components removed it,
and the edge can now serve the HTML. That is why the TTFB moved without a single route being
adopted — the opt-outs govern *validation*, not whether the response may be cached.

**Checked against the obvious objection**, that these were only warm because of the
measurement itself: `/legal/cookie-policy`, `/collections/sneaker-edit` and
`/collections/everyday-essentials` — none of them requested before — all answered
`X-Vercel-Cache: PRERENDER` with **`Age: 0`** at ~0.17s. Served from prerendered output, not
from a cache this session had warmed.

**One thing that does not reconcile, and is recorded rather than explained away.** A local
`next build` still reports 154 routes as `ƒ Dynamic`, including `/` and `/about`, while it
also generates 339 static pages and production serves those same routes as `PRERENDER`. The
build's route table and the edge's behaviour do not agree. The user-visible result is
measured and not in doubt; the bookkeeping behind it is not fully understood, and anyone
planning the per-route adoption should start by resolving that rather than trusting the
table.

**What this changes about the plan.** Tier 2's remaining per-route work is still worth doing,
but it is no longer the difference between 1s and 0.2s — that has already been collected. It
is now an incremental gain on top, which lowers its priority against `PERF-001`.

### Adoption attempted 2026-09-07 — the documented blocker fell, a new one did not

The owner chose the **Greek-static shell**: render `<html lang="el">` and Greek chrome
unconditionally, swap the ~90 English strings client-side after hydration. That decision stands
and is the right one for this shop — all 182 product names are Greek-only, and a crawler
arriving without a cookie already gets Greek.

**The locale blocker is genuinely solvable, and was solved.** `getLocale()`/`getMessages()` came
out of the root layout, a client `LocaleProvider` took over the swap, and `LanguageSwitcher`
moved off its server action — which had stopped being able to work, since re-rendering a
locale-independent shell on the server returns identical markup. Typecheck and lint clean.
**This entry can stop describing the locale as the thing standing in the way.**

**But it was not the last blocker.** With the cookie read gone, the build named the next one:

```
Route "/_not-found": Next.js encountered uncached or runtime data during prerendering.
  at RootLayout (app/layout.tsx:70)  const seo = await getSeoDefaultsCached();
```

That call was already cached, and converting it to `"use cache"` appeared not to satisfy the
validator. **That reading was wrong — see the diagnosis below.**

#### Diagnosed 2026-09-07 — `"use cache"` was never the problem

The entry above recorded this as undiagnosed. It is now diagnosed, and **the earlier reading was
my mistake, not a framework defect.**

**Next's prerender error names the nearest render position, not the actual uncached access.** It
pointed at `getSeoDefaultsCached()` in the root layout, so I concluded that call was being
rejected despite its `"use cache"`. It was not. Clearing the blockers nearer the leaf makes the
message walk inward until it finally names the real one — the error is a starting point, not an
address.

**Proven by bisection**, on a throwaway build that was reverted:

| Step | Where the error moved to |
| --- | --- |
| Locale out of the layout, layout opt-out off | `getSeoDefaultsCached()` — layout line 71 |
| `/_not-found` opted out, homepage opt-out off | `<JsonLd>` — layout line 106, a *JSX* line |
| `getNavigation`, `getSiteSettings`, `getVisibleHomepageSections` given `"use cache"`, page switched to `getSeoDefaultsCached` | **`SectionRenderer.tsx:27` — `await getLocale()`** |

The third row is the answer. `"use cache"` worked on every function it was applied to; the error
moved *past* all of them. What actually blocks the homepage is a **server-side locale read in a
component** — `SectionRenderer` — not in the page.

**Which also corrects the scope figure above.** "5 storefront routes are locale-free" was
measured by grepping page files. It missed component-level locale reads: `app/page.tsx` is clean,
but the `SectionRenderer` it renders is not. The real count of ready routes is lower and cannot
be established by grepping pages.

**So `PERF-002` is open for two concrete reasons, neither of them mysterious:**

1. **Almost nothing in the service layer is cached.** `"use cache"` appears in **1 of 48**
   service files. Prerendering a route requires *every* read in its tree to be cached or
   suspended, and each storefront route pulls several.
2. **Server-side locale reads live in components, not only pages.** Each has to be moved to the
   client or lifted out, and 58 client components consume the provider that must keep working
   throughout.

That is a services-layer migration, not a per-route flag flip — but it is now a list of ordinary
work with a build that names the next item each time, rather than an unexplained wall.
**Reverted rather than left half-done**, on the same reasoning as the first tier 2 attempt: the
groundwork alone delivers nothing measurable — the layout opt-out has to go back on for the
build to pass — while changing how locale is provided across a live shop carries real risk. A
partially migrated rendering model is worse than an unmigrated one. Tree clean, build green,
339 static pages.

**The real scope, measured rather than estimated.** The "82 TODO markers" framing overstated the
work and understated its shape:

| Opted-out pages | 77 |
| --- | ---: |
| Admin | 47 — personalised and behind auth; **PPR is not wanted there at all** |
| Storefront reading locale server-side | 25 — each needs its own conversion |
| Storefront already locale-free | **5** |

So the layout fix does not unblock 82 routes. It unblocks **five** — but they include
`app/page.tsx`, the homepage, plus legal, campaigns, landing and shipping-returns. The other 25
are a per-page refactor, and 58 client components call `useTranslations`, so the provider has to
keep working throughout.

**A red herring worth naming.** The build output is dominated by `ENVIRONMENT_FALLBACK` errors
pointing at `useTranslations` in `CookieConsentBanner`. They are **not** the prerender failure —
reading next-intl's source shows the code is raised for a missing `timeZone` config, a markup
mismatch warning. Anyone debugging this will chase them first; they are noise.

**A correction to the codebase's own claim, found while checking.** `i18n/config.ts` states that
categories, collections and legal pages "have no translation column at all". They do, and they
are populated: `categories.nameEl` **11 of 11**, `collections.titleEl` and `subtitleEl` **5 of
5**. Only products are untranslated — **0 of 182** — which is the bulk, so the one-URL-set
decision still holds. But the sentence it rests on is out of date, and the day products get
translated is the day that decision needs re-taking.

### DEFERRED 2026-09-07 — the headline benefit already landed, the rest is future value

**Deliberately deferred, with a reason and a trigger**, rather than left open as work anyone
should feel behind on. Nothing here is broken: this is an optimisation whose main benefit has
already been collected.

**The measurement that decides it.** Every one of these is classified `ƒ Dynamic` by the build,
and every one is served from the edge in roughly the same time:

| Route | Build says | Warm TTFB |
| --- | --- | ---: |
| `/` | `ƒ` dynamic | 0.31s |
| `/about` | `ƒ` dynamic | 0.18–0.24s |
| `/legal/cookie-policy` | `ƒ` dynamic | 0.24–0.31s |

**The CDN is already doing the job Partial Prerendering would do**, because dropping `no-store`
made the responses cacheable. That was the fivefold win, and it arrived from the pre-step without
a single route being adopted.

**What adoption would still buy: the cache-miss case only** — the first visitor to a cold edge
node, and the first after a revalidation. Measured here as ~0.70–0.84s against ~0.2s warm. Real,
but a minority of views, and a shrinking one: the busier the shop gets, the less often the cache
misses. **The value of this work grows later, not now.**

**Against that, the cost is a services-layer migration** — `"use cache"` into ~47 files, the
server-side locale reads moved out of components, and 58 client components that must keep working
throughout — on a shop taking real orders, where both attempts so far had to be reverted.

**And two open items beat it on value per unit of risk.** `OPS-001` is not a speed problem but a
compliance one: the retention cron does not run, so the GDPR position `PRIV-001` describes is not
actually being honoured. That is the only genuinely *wrong* thing left in this document.
`PERF-001` is one billing decision for the largest remaining score gain, with no refactor at all.

**Revisit when either of these becomes true:**

1. **Traffic grows enough that cache misses are a meaningful share of page views.** The upside
   above is entirely in the miss path, so this is the point at which it starts paying.
2. **Products get translated.** `products.nameEl` is empty on all 182 rows today. The day that
   changes, `i18n/config.ts`'s own argument says the shop should move to locale-prefixed routing —
   which forces the locale question anyway, and makes this refactor necessary for its own reasons
   rather than for speed.

A third, weaker trigger: if the cart bootstrap's ~2.3s wait for hydration ever becomes the thing
worth fixing (`PERF-004` names it), server-rendering the initial cart is this same work.

**Deferred:** _the fivefold TTFB gain is banked; the remainder is a large refactor for the
cache-miss path, worth doing when traffic or translation makes it pay._
**Fixed:** _tier 1 done (`92cf413`, no measurable effect). Tier 2 pre-step done (`34629b3`) and,
contrary to what this entry originally claimed, it cut warm TTFB three- to fivefold — see the
2026-09-06 re-measurement.
Per-route adoption open — 82 TODO markers, root layout first, blocked on the localisation
decision._

---

## [x] PERF-004 · Adding to the cart took 1.25s, and eight round trips to do it

**Category:** Performance
**Location:** `services/carts.ts` → `addLineItem`, `lib/rate-limit.ts` → `enforceRateLimit`
**Confidence:** Confirmed — measured on production before and after
**Found:** 2026-09-07, **by the owner**, who noticed the button felt slow and asked why

**Worth recording who found it.** Every other finding in this file came from an audit pass or a
test. This one came from someone using the shop and noticing it felt wrong — and it was real.

**Measured before touching anything:**

| | |
| --- | ---: |
| Add to cart, cold | 2931 ms |
| Add to cart, warm (×3) | 1232 / 1259 / 1246 ms |
| Cart bootstrap on page load | 1785 ms |
| …which does not start until | 2328 ms, after hydration |

So a shopper who lands and clicks quickly waits for the bootstrap (~4.1s from page start) **and
then** the add. `BUG-002`'s fix is what makes the click wait rather than vanish — correct, and
it makes the latency visible instead of silently dropping the click.

**Cause: not one slow query — eight sequential round trips**, each awaiting the last. Two of
them bought nothing:

- **A discarded full read.** Nine cart mutations opened with `await requireCartRow(cartId);` and
  threw the row away — a full `cartInclude` read, line items and all, to establish that one row
  exists. Each of those already re-reads the whole cart at the end to return the new state. Two
  full reads per write, one wasted.
- **Needless sequencing.** "Does this cart exist" and "what is this product" are independent
  questions asked one after the other.
- **A blocking rate-limit write**, awaited before any real work, though it has no bearing on the
  answer already computed.

**Fixed** (`a0a7570`): `requireCartExists` does the existence check with `select: { id: true }`
— which helps every cart write, not only add-to-cart — the two independent reads run together,
and `enforceRateLimit` stopped awaiting its own INSERT.

**The rate-limit change is a security question, and was checked before being made.** Nothing
guarding a credential goes through `enforceRateLimit`: sign-in, sign-up, password reset,
change-password, admin login and the OAuth routes all call `isRateLimited` and `recordAttempt`
separately, because they must choose what counts as an attempt — a *failed* sign-in, not a
successful one. Those still await. `enforceRateLimit` covers volume limits only. That boundary
is now written next to the code so nobody moves a login onto the convenient helper.

**Result, measured the same way on production:**

| Add to cart, warm | Before | After |
| --- | ---: | ---: |
| | ~1245 ms | **~1045 ms** |

**I predicted ~400ms and got ~200ms.** Parallelising two queries only saves the shorter of the
two, not a whole round trip — the arithmetic was optimistic and is corrected here rather than
quietly rounded up.

**What is left, and it is not in this finding's gift.** The bootstrap does not begin until client
JS hydrates at ~2.3s, because the cart is fetched from the browser. Server-rendering the initial
cart removes that entirely — and that is `PERF-002` work, blocked behind the same question.

**Fixed:** _`a0a7570`, verified on production._

---
## [x] PERF-003 · Most of the image payload is JPEG the pipeline could already be storing as WebP

**Category:** Performance
**Location:** Vercel Blob store — `products/*` and `products/wc-import-3x4/*`
**Confidence:** Confirmed — every file fetched and measured
**Found:** 2026-09-06, while checking whether anything about performance was fixable without a billing decision

**Problem.** `PERF-001` is blocked on the Vercel image-transform quota, and that has been
treated as *the* image problem. It is not the only one. The homepage loads **2.68 MB** across
29 image files, and they are stored in two different formats:

| Format | Files | Bytes | Average |
| --- | ---: | ---: | ---: |
| JPEG | 15 | **1.98 MB** | 135 KB |
| WebP | 14 | 0.70 MB | 51 KB |

**Half the files carry three quarters of the weight.** The largest single image is **415 KB**;
four more are over 150 KB.

**Why this is separate from `PERF-001`.** That finding is about Vercel transforming images on
delivery, which costs money the account does not currently have. This is about what is *stored
in the bucket*. The 14 WebP files prove the upload path can already produce WebP — so the
JPEGs are not a capability gap, they are a backlog of files that predate it.

**Fix.** Re-encode the 15 JPEGs to WebP and update the stored URLs. On the observed averages
(135 KB → ~51 KB) that is roughly **1.2 MB off the homepage**, near halving the image payload,
with no plan change and no code change to the rendering path.

**Risk of change:** Low but not zero — it rewrites stored asset URLs, so it wants the same
care as any data migration: convert alongside the originals, repoint, then delete only once
the pages are verified. Quality loss is the other watch item; these are product photographs
for a footwear shop, where the image is the product.

**Not to be confused with a fix for `PERF-001`.** Optimised *delivery* still buys responsive
sizes and modern formats per device, which re-encoding the source does not. This narrows the
gap; it does not close it.

### Done — 2026-09-06

**The finding understated itself by a factor of twenty.** It was scoped from the homepage's 15
JPEGs. The catalogue holds **311**, across 182 products, 11 categories and 5 collections.

| | |
| --- | ---: |
| JPEGs found in the database | 311 |
| Converted to WebP | **309** |
| Kept as JPEG by the size guard | 2 |
| Failed | **0** |
| Bytes | 32.39 MB → **15.61 MB** |
| **Saved** | **16.77 MB (52%)** |

**Quality was measured, not assumed.** WebP q85, no resizing — a pure format change. PSNR
against the originals' own decoded pixels came out at **42.7–48.9 dB** across a deliberate
spread of the catalogue, comfortably above the ~40 dB at which photographic differences stop
being visible. A product page was then loaded and looked at.

**q95 was rejected on evidence:** it produced files *larger* than the JPEGs they replaced
(266 KB → 296 KB). The intuition that "higher quality is safer" is exactly wrong here.

**The two skipped files are the guard working.** The rule was: replace only if WebP is at least
10% smaller. One of the two would have grown, 416 KB → 418 KB. Both are larger-dimensioned
than the catalogue norm (1200×1598 and 934×1400 against 1000×1333) and resist WebP even at q70,
where the saving would cost visible quality on a photograph that *is* the product. They stay
JPEG, deliberately.

**Nothing was deleted.** The originals remain in the store, a column-level backup was taken
before the write, and `migration-map.json` holds the reverse mapping — so rollback is a single
scripted pass, not a restore. The 315 database references were rewritten in **one transaction**.

**Verified after:** 64 images across four pages, **zero broken**; homepage payload
**2.68 MB → 2.07 MB**; a product page loaded and inspected.

**Why the homepage moved less than the catalogue (23% against 52%).** The two images the guard
refused are among the heaviest on it — 0.65 MB of the 0.76 MB of JPEG still there. The
page-level number is dominated by exactly the files that could not be improved for free.

**Checked and found NOT to be a problem**, having first suspected it: the LCP image is **not**
lazy-loaded. The hero renders as the first `<img>` with no `loading` attribute, which is
eager, and `Hero.tsx` sets `priority` correctly. An initial count of 29 `loading="lazy"`
attributes was mistaken for *all* images being lazy when there are 30 — the hero is the one
without it.

---

## [x] SEO-002 · Unknown product, category and collection URLs answer 200 instead of 404

**Category:** SEO / Correctness
**Location:** `app/products/[slug]/page.tsx`, `app/category/[slug]/page.tsx`, `app/collections/[slug]/page.tsx`
**Confidence:** Confirmed — reproduced on production against uncached (`X-Vercel-Cache: MISS`) requests
**Found:** 2026-09-06, by the browser suite, while verifying an unrelated change

**Problem.** A URL for a product that does not exist renders the "δεν βρέθηκε" page — with
**HTTP 200**. The same holds for `/category/*` and `/collections/*`. That is a soft 404: an
infinite space of URLs that report themselves as real pages.

**This was passing until `34629b3`.** The test `an unknown product slug 404s rather than
erroring` is older than the finding and was green on the 40/40 run recorded in this file. The
only rendering change since is Cache Components.

**Cause, from Next's own bundled guide** (`node_modules/next/dist/docs/01-app/02-guides/streaming.md`),
read rather than guessed:

> Once streaming begins, the HTTP response headers (including the status code) have already been
> sent to the client. **You cannot change the status code or headers after streaming starts.**
> […] If a `notFound()` fires mid-stream, Next.js cannot go back and change the status to 404.

A route with a prerendered shell has already committed `200` before the code that decides the
page does not exist has run. The `notFound()` calls are all correctly placed and all still
execute — they simply cannot alter a status line that is already gone.

**Severity is bounded by a mitigation, and it was verified rather than trusted.** The same guide
says Next injects `<meta name="robots" content="noindex">` in this situation, and production
does:

| URL | `robots` meta |
| --- | --- |
| A product that does not exist | `noindex` |
| A real product | `index, follow` |

So the phantom pages are not indexable. **My first reading of this finding was that Google would
index them, and that was wrong** — the framework already handles the part that would have made
this urgent.

**What is still wrong.** A 200 for a missing resource misleads everything that is not a search
crawler: link checkers, uptime and broken-link monitoring, analytics, and any client that trusts
status codes. It is also simply incorrect.

**Fix, per the guide:** perform a cheap existence check *before* anything that can start the
stream, so the status is still open when `notFound()` runs. In this codebase the lookup is
already early — it sits behind three `await`s (translations, shipping rates, params) that come
first — but with a prerendered shell the stream may already have begun regardless, so the real
fix likely involves how these routes opt into prerendering rather than statement order alone.

**Deliberately not fixed in this session.** It changes the rendering model of a live shop, it
cannot be verified without deploying, and this was found at the end of a long session while
doing unrelated work. That is the same reasoning that governed the `PERF-002` tier 2 revert, and
it applies here for the same reasons.

**Held visible rather than hidden.** The test now carries `test.fail()` with the cause written
next to it, so the suite is green while the defect stays on the report — and if it is ever fixed,
Playwright fails loudly with "expected to fail but passed". A second test pins the `noindex`
mitigation separately, because that mitigation is the only thing keeping this a defect rather
than an emergency.

**Risk of change:** Medium — it touches how three high-traffic routes render.

### Fixed — 2026-09-06, and not where the guide pointed

The documented fix is to run the existence check before anything that starts the stream. **That
is not available here.** The stream is started by the shell, not by the page: the root layout
flushes early by design — its own comment records moving the cookie banner ahead of `{children}`
so it "paints with the shell" — and with a prerendered shell the status is committed before the
page component's code is reached at all. No amount of reordering inside the page can win a race
that is already over.

**So the 404 moved to `proxy.ts`, which is where this codebase had already solved the same
problem once.** The renamed-slug redirects live there for exactly this reason, and the comment
above them already said it: *"`/category/[slug]` streams […] The proxy runs before any response
begins, so it can return a real 308."* A 404 is the same shape of problem as a 308, and the
answer was already written down.

**It costs no extra query on two of the three routes.** `renamedCategoryRedirect` and
`renamedProductRedirect` already look the slug up to decide whether to redirect; the case where
both the live record and the rename history come back empty *is* "this does not exist", and it
was previously falling through to the page. It now returns a status instead. Collections pay one
new indexed lookup, because they had no redirect logic to borrow from.

**The visibility rules were mirrored rather than re-invented**, so the two definitions cannot
drift: `status: "active"` for products (matching `PUBLISHED` in `services/products.ts`) and
`isVisible` for categories (matching the page's own guard). A side effect worth naming — a hidden
category and a draft product now return a **hard** 404 where they previously returned a soft one.

**The fix quietly removed something, and the test caught it.** While unknown URLs answered 200, Next injected `noindex` automatically — that only happens when `notFound()` fires mid-stream. Reaching the page by a proxy rewrite means `notFound()` never fires, so the meta disappeared with the defect. The 404 status more than replaces it, but losing a signal as a *side effect of a fix* is exactly what goes unnoticed, so `app/not-found.tsx` now sets `robots: { index: false }` explicitly — covering both routes to the page, the rewrite and any `notFound()` from a route the proxy does not match.

**A human still gets the shop's own 404 page.** The response is a rewrite to `/_not-found` with
the status set on it, not a bare body: 90 KB, header, footer, Greek copy, and the
`noindex` meta still emitted.

**Verified on a local production build before deploying**, because the whole finding is about a
status code that only production rendering produces:

| | Before | After |
| --- | ---: | ---: |
| `/products/<unknown>` | 200 | **404** |
| `/category/<unknown>` | 200 | **404** |
| `/collections/<unknown>` | 200 | **404** |
| A real product, collection, homepage | 200 | 200 |
| A renamed product slug | 308 → correct target | 308 → correct target |
| A hidden category | 200 (soft) | **404** |

**Tests:** the `test.fail()` annotation is gone and the assertion stands on its own again, plus a
new spec covering category and collection. Products alone would have passed while the other two
stayed soft — which is precisely how this went unnoticed, since only the product route had a
test.

**Fixed:** _proxy issues the status; verified against a local production build and then against
production after deploy._

## [ ] PERF-001 · Image optimization disabled globally
`next.config.ts` → `images.unoptimized: true`. Deliberate and documented — the Vercel transform quota was exhausted and returning 402s, breaking images across the shop. Real bandwidth/LCP cost (~100KB JPEGs served raw).
**Fix.** Re-enable via `NEXT_PUBLIC_OPTIMIZE_IMAGES=true` once the plan allows.
**Fixed:** `ed460cc`

## [x] LOG-001 · `lib/logger.ts` adopted in only 2 files
Folded into OBS-001 — listed separately so the cleanup is not forgotten once error tracking lands.
**Fixed:** Phase 1 — adopted in checkout, orders and the webhook route; `logger.error` now serializes the error itself.

## [x] MONEY-001 · `round2` half-cent edge
`Math.round(v * 100) / 100` yields `1.005 → 1.00`. Sub-cent, rare, and money is stored as `Decimal(10,2)` so it never compounds.
**Fix (optional).** Epsilon-corrected rounding, or move cart math to integer cents.
**Fixed:** Phase 4 — `round2` now corrects for binary floating point. `Math.round(1.005 * 100)` was 100, not 101, because 1.005 is stored as 1.00499999999999989… — a cent lost on the one input anybody would test. Pinned by four tests including the negative side and the 0.1+0.2 case.

---

# INFO — no action required

- **Cart creation is rate limited to 60 per 10 minutes per IP**, and a cart row is created on
  *first page load*, not on first add — so the budget is spent by browsing, not by buying.
  Correct as a protection and **not to be raised**, but worth knowing it is shared: everyone
  behind one NAT — a mobile carrier, an office, a school — draws on the same 60. Discovered by
  running the browser suite against production twice in quick succession, which exhausted it
  and produced a convincing impersonation of a mobile-only add-to-cart bug. An hour went into
  chasing that before the rate-limit table gave it away; `playwright.config.ts` now says so at
  the top so nobody repeats it.
- **Neon hands out `sslmode=require` on every new branch.** The connection string its API and
  console generate defaults to `require`, so any branch created from now on arrives carrying the
  setting that was just pinned away everywhere else. Noticed because the `pg` warning reappeared
  during the restore drill from a temporary branch's own URI, minutes after production had been
  fixed. Not a defect — just a default that will keep re-introducing itself, worth knowing
  before it looks like a regression.
- ~~**Rate-limit pruning is opportunistic** (1% of calls, >24h old). Unreliable at low traffic; harmless.~~ **Superseded 2026-09-07, and it was not harmless.** "Unreliable at low traffic" was the whole problem: on a day this shop recorded 61 attempts, a 1-in-100 gate has an expected **0.6** firings, so the cleanup was least likely to run exactly when it was the only thing running. Replaced by `runDataRetentionIfDue` — the full documented policy, time-guarded to once a day, driven from request traffic (`OPS-001`).
- **The ACS courier integration has never been exercised against a live account**, and there is a trap in enabling it. `ACS_API_KEY` currently holds a **3-character placeholder** while `getCourierProvider()` only checks each credential is non-empty — so the half-configured fallback to `manual` will **not** fire, and setting `COURIER_PROVIDER=acs` today would build a real client with a junk key and fail every shipment against ACS auth. The request side was verified against ACS's published spec on 2026-09-07 (`/swagger/docs/v1` — the Swagger UI itself cannot load its own definition, CORS); the **response** side cannot be verified from that document at all, since ACS declares `"responses": {"200": {}}` and an empty `"definitions"`. The defensive multi-key parsing in `lib/courier/providers/acs.ts` is therefore load-bearing and must not be tidied into one confident key name before a real voucher has come back. Blocked on ACS issuing an API key — ask for **test** credentials, since `ACS_Create_Voucher` makes a real billable label with no idempotency key. Full detail in `NOTES.md`.
- **No E2E or component tests** — covered by TEST-001.
- **Email silently fails for real customers until the Resend sending domain is verified.** Operational and known. Correctly non-fatal in code: `sendOrderConfirmationEmail` claims-then-releases so a later retry can send.
- **`/checkout` lacks `noindex` metadata** — covered by the robots.txt disallow; the confirmation page does have it.
- **Cart/checkout are a documented capability-token model** — ids authorize operations. Consistent and deliberate; SEC-001 hardens the sharpest edge of it.

---

# Verified correct — do not re-audit

These are the things most likely to be wrong in a generated commerce app. They were checked and are **right**. Recorded so future audits do not re-litigate them.

| Area | Finding |
|---|---|
| **Oversell race** | `UPDATE … WHERE quantity >= n` — affected-row count *is* the check. Demand aggregated per stock row first, so one size appearing twice in a cart cannot double-pass. |
| **Gift-card double-spend** | Same conditional-UPDATE guard, plus a live `active` re-check at order time. |
| **Duplicate orders** | `checkoutId` unique constraint + explicit P2002 recovery returning the winner's order. |
| **Webhook replay** | `@@unique([provider, eventId])`; sha256-of-body fallback id for providers without event ids; unverified → stored + 400. |
| **SQL injection** | 38 raw queries, **all** tagged templates. Zero `$queryRawUnsafe`, zero `Prisma.raw()`. No injection surface. |
| **XSS** | Only 2 `dangerouslySetInnerHTML`: JSON-LD (escapes `<`, U+2028/29) and a static literal. |
| **Authorization** | All 22 server-action files guarded — verified per-function by body analysis, not grep. Admin role read **live from the DB**, so demotion/deletion take effect immediately rather than at token expiry. |
| **Session cookies** | `httpOnly` + `secure` (prod) + `sameSite=lax` (correctly lax — Strict would break payment-redirect return) + path + maxAge. |
| **Secrets** | `.env` never committed (checked against full git history). Provider secrets AES-256-GCM at rest. Demo admin credentials deliberately removed. |
| **Money** | `Decimal(10,2)` in Postgres, `round2` at every boundary, totals never trusted from the client. |
| **Serverless DB** | Pooled Neon endpoint for the app, direct endpoint for migrations. Correct. |
| **Rate limiting** | DB-backed sliding window — actually works across lambdas, unlike an in-memory limiter. |
| **Type safety** | `strict: true`, **0** `any`, **0** `@ts-ignore`, **0** TODO/FIXME in source. |
| **SEO** | `noindex` on all 9 private route groups + robots.txt, with correct crawl-vs-index reasoning. |
| **Dead code** | **None found.** Zero unused production dependencies (`pg`, `server-only`, `tw-animate-css`, `react-dom` verified genuinely used), zero commented-out code, zero debug statements. |

**Two findings withdrawn during the audit** — both looked wrong and were not:
- The order-confirmation email **is** correctly try/caught with a claim-and-release retry pattern.
- Admin roles **are** read live from the database, not trusted from the JWT.

---

# Fix order — completed

All four planned phases are done. Kept for the record, since the order was itself a decision.

| Phase | Items | Commit |
|---|---|---|
| 1 — before launch | `SEC-004` → `SEC-002` → `AUTH-002` → `OBS-001` (partial) | `782d243` |
| 2 — before card payments | `PAY-001` (hard gate) · `PAY-002` · `TEST-001` | `c731ab0` |
| 3 — first weeks live | `AUTH-001` · `PRIV-001` · `OBS-002` · `SEC-001` | `493ae9c`, `03ad4c4` |
| 4 — hardening | `A11Y-001` · `MONEY-001` · `DEP-001/002` · `SEC-005` | `4684a25` |
| post — found in live use | `BUG-001` · `OBS-001` completed | `817e50b`, `e7ae303` |

**SEC-004 went first on purpose:** it is thirty minutes of work and it gates whether every
other rate limit in the app — including admin sign-in — actually functions. Fixing anything
else first would have been building on it.

**Two findings were discovered during remediation, not during the audit:** `SEC-005` (a CSP
policy silently discarding both Instagram hosts) and `BUG-001` (a wishlist race returning a
500 in ordinary use). Both came from *running* the app — one from a browser console warning,
one from a real error the owner hit — rather than from reading it. Worth remembering the
next time an audit reads clean.

---

# Scores

Re-scored after Phases 1–4. The original number is kept beside each so the movement is visible.

### Why 95 → 92 is an improvement, not a regression

Anyone seeing the headline fall will reasonably assume something broke. Nothing did.

| | Printed | Its table's actual mean |
| --- | ---: | ---: |
| 5 September | **95** | **91.64** |
| 6 September | **92** | **92.27** |

The real score **rose by 0.64**. Two dimensions moved, in opposite directions and for
opposite reasons: Performance **+11** on a measured fivefold TTFB improvement, and Reliability
**−4** because the retention cron was found not to run — a defect that was **already true** when
92 was written, not one introduced since. Net **+7** across the dimensions.

The headline fell anyway because it had been carrying about three points it never earned. Both
corrections landed in the same pass, so a genuine gain and a bookkeeping fix cancelled out in
the one number most people read.

**Overall is the mean of the dimensions above it, rounded** — not a separate judgement. Stated
because it had stopped being true: the *Before* column averaged its ten dimensions (73.2 → 74)
while *Now* read 95 against an average of 92.3, so one column held two numbers produced two
different ways. Anyone changing a dimension should recompute the total rather than re-feel it.

| Dimension | Before | Now | What moved it |
|---|---:|---:|---|
| Security | 82 | **93** | Rate limiting no longer keyed on a spoofable header; checkout bound to its browser; sessions revocable; login timing oracle closed; email escaping consistent. Held back only by `unsafe-inline` (SEC-003). |
| Correctness | 88 | **97** | Webhook amounts verified; refund race closed; money rounding fixed at the half-cent; a real CSP bug found and fixed. |
| Reliability | 78 | **91** | Health endpoint plus **live uptime monitoring**, structured logging in every money path, and **every outbound provider call bounded** (`REL-001`) — no supplier can hold a checkout invocation open indefinitely. **Lowered from 92 on 2026-09-06.** That score credited "scheduled retention", and the schedule does not run: two slots have now passed untouched with every explanation eliminated (`OPS-001`). A job that only works when a human remembers to trigger it is not a reliability feature, and scoring it as one was the kind of error this file exists to catch. **Held at 88 earlier on 2026-09-07, then raised to 91 the same evening once it had been WATCHED**: the fallback ran unattended in production and cleared 492 overdue rows to zero, and `email-followups` was shown firing inside its slot on five dated occasions, so the scheduler works here after all. Not restored to 92, deliberately — that number credited a true schedule, and a traffic-driven fallback is weaker: a shop with no visitors for two days does not run retention. Also no circuit breakers. |
| Performance | 72 | **85** | Re-measured 2026-09-06 and raised, for the first time on evidence rather than reasoning. `PERF-002`'s tier 2 pre-step turned out to be most of the fix rather than the no-op this file recorded: removing `no-store` let Vercel's edge hold the HTML, and warm TTFB fell from ~1.0s to **~0.2–0.4s**. Still short of full marks for one measured reason — `PERF-001` keeps images unoptimised, and `PERF-003` found 2.68 MB of homepage images of which 1.98 MB is un-converted JPEG. The *server* is now fast; the *page* still carries the weight. |
| **Testing** | 45 | **97** | The three concurrency guards are pinned against the **real pooled database**, plus 29 unit tests across auth, email, money and CSP — and **32 Playwright specs on desktop and mobile** covering the purchase funnel, the cart, the first checkout step and a WCAG scan. They have now found two real bugs on first run, `BUG-002` and `A11Y-002`. And `completeCheckout` is now covered **end to end against the real service** on a Neon test branch, closing the last gap — including ten simultaneous buyers racing for one unit. **96 → 97 on 2026-09-07**: 455 → 487 tests, and more to the point one of them was *verified to fail against the pre-fix code* (`services/cart-merge.test.ts`, `BUG-004`) rather than assumed to cover what it claims — which is the same standard `OPS-001` spent three days learning. |
| Maintainability | 95 | **95** | Already exceptional; held there deliberately — every fix followed the existing patterns rather than inventing new ones. |
| **Observability** | 25 | **98** | Health check, adopted logger, Sentry **proven by a forced event** rather than assumed — which is what caught the DSN typo — an audit trail covering 8 admin surfaces instead of 2 (`OBS-003`), and **uptime monitoring live and verified**. **Cron check-ins shipped AND observed on 2026-09-07** (`services/cron-runs.ts`) — every scheduled job records when it ran and what triggered it, and `/api/health` serves `staleCronJobs` in production. Raised 96 → 98 only after the deployed endpoint was read back, because this cell had named exactly that gap ("cron check-ins so a job that never runs announces itself") as its remaining work. The remaining points are correlation IDs. |
| Deployment | 80 | **94** | Both migrations dry-run in rolled-back transactions before applying; a third cron added; **`ROLLBACK.md` now documents the procedure** — how to tell a code problem from a schema, infra or data one, and why promoting a previous Vercel deployment beats every other first move. |
| Accessibility | 75 | **89** | Skip link (WCAG 2.4.1 Level A), plus an **axe scan at WCAG 2.1 A/AA across six pages** on every run — which immediately found `A11Y-002`, colour swatches that announced as nothing. Held below 90 deliberately: axe checks the machine-checkable half, and a real screen-reader pass is still the next gain. |
| SEO | 92 | **94** | SEC-005 fixed a policy that would have blanked the Instagram feed. |
| **Compliance** (new) | — | **91** | Added on 2026-09-05, because `PRIV-002` showed the scoring had no axis for it: an obligation with no code behind it could not lower any number. GDPR retention (`PRIV-001`), access and erasure (`PRIV-002`) are implemented; legal pages are live in Greek with controller identity and lawful bases. **Raised 88 → 91 on 2026-09-07**, when retention was finally *watched* doing its job: an unattended pass cleared 492 rows of IP addresses past their stated window down to zero. The 88 was explicitly held pending that. Still short of higher because erasure is exercised by tests rather than by a real Article 17 request, and because the retention that now runs reliably is a fallback rather than the schedule `PRIV-001` describes. **Held at 91 on 2026-09-08** rather than raised for the data-subject UI: that work made a claim this axis had already been scored on actually true, and correcting an overstatement earns no points. |
| **Overall** | **74** | **93** | **Ready to launch.** 1024 / 11 = **93.09**, against 92.27 the previous pass (which itself corrected a 91.64 that had been *printed* as 95). Four dimensions moved on 2026-09-07 and every one of them only after the thing being scored was **observed running in production**, never on a deploy: Reliability 88 → 91, Observability 96 → 98, Compliance 88 → 91, Testing 96 → 97. Reliability and Compliance had both been explicitly frozen that morning pending exactly that evidence, which is the rule working rather than being applied to itself. |

---

# What is left, and what it is worth

Reconciled 2026-09-05. Everything above this line is done; below is only what remains.

### Yours — no code, and the first four are minutes each

1. **Run `npm run cron:status` after 04:30 UTC** (`OPS-001`) — one command, and it now answers
   the question directly instead of by inference. `schedule` means the scheduler is alive and
   this closes; `fallback` after a slot has fully elapsed means it is not. Note the script
   deliberately refuses to conclude anything until a slot has passed *under observation* —
   telling you the cron is dead before it has had a chance is the exact error this finding
   made three times.
2. **Decide on the 6-hour restore window.** Found by drilling the restore: a problem noticed
   the next morning **cannot be restored away**. Either accept that and keep destructive work
   early in the day, or pay for longer history retention. See `ROLLBACK.md`.
3. **Narrow the Sentry alert rule.** No score change, but it decides whether the Observability
   score means anything. An alert that fires on everything is one you mute within a fortnight.
   Sentry's Create Alert chooser offers no "Issues" type — edit the existing rule's action
   interval instead of creating a new one.
4. **Re-enable image optimization** (`PERF-001`) → Performance 74 → ~85. Purely a
   billing decision, and the largest single number left on the board.

### Code — ranked by value per unit of work

6. **Run the backup-restore drill** → Deployment 90 → ~96. Now possible without risk: restore
   into a second Neon branch, confirm the data comes back, and write the result into
   `ROLLBACK.md`. It is the only disaster path never exercised, and this session's whole
   lesson is that unexercised things do not work.
7. **GDPR data-subject tooling** (`PRIV-002`) → Compliance. There is no way to fulfil an
   access or erasure request without hand-deleting across six tables while preserving what
   Greek tax law requires you to keep. Small feature, real obligation.
8. **Correlation IDs** through request → log → Sentry → audit entry → Observability 94 → ~97.
   Turns "a customer says their order failed around 14:30" into one query instead of a hunt.
9. **`SEC-003`, the CSP nonce** → Security 93 → ~97. **A spending decision before an
   engineering one** — it forces every page to render dynamically, on an account already over
   its image quota. Evaluate hash-based SRI first; see the entry.
10. **Integer cents instead of floats** → Correctness 97 → ~98. Large refactor, small gain now
    that `round2` is correct. Genuinely not worth it yet.

### Needs a person, not a machine

11. **An accessibility pass with a real screen reader** → 89 → ~95. The axe scan covers the
    machine-checkable half of WCAG and runs on every commit; the other half is whether the
    checkout *makes sense* read aloud. Nobody has listened to it.

---

## Changelog

**The Commit column is the commit this entry landed in**, which for a row that *records*
earlier work is the documenting commit, not the code one. Those rows name the code commit
inline instead — row `67a6295` recording tier 1's result names `92cf413` in its text. Every
**Dates come from the commit, not from memory.** Six entries were stamped 2026-09-06 when
the commits carrying them are timestamped 2026-09-07 — a long session ran past midnight and the
date was assumed rather than checked. Corrected against `git log`, which is the only reliable
source once a session crosses a day boundary.

hash here was recovered from history and checked to resolve; they replace a `_this commit_`
placeholder that named nothing once the file was pushed.

| Date | Change | Commit |
|---|---|---|
| 2026-09-03 | Initial audit against `be0d546` | `744d702` |
| 2026-09-03 | Phase 1: SEC-004, SEC-002, AUTH-002, LOG-001; OBS-001 partial | `782d243` |
| 2026-09-03 | Phase 2: PAY-001, PAY-002, TEST-001 | `c731ab0` |
| 2026-09-04 | Phase 3: AUTH-001, PRIV-001, OBS-002 | `493ae9c` |
| 2026-09-04 | Phase 3: SEC-001 — phase complete | `03ad4c4` |
| 2026-09-04 | Phase 4: A11Y-001, MONEY-001, DEP-001/002, SEC-005 (new); SEC-003 deferred; re-scored 74 → 86 | `4684a25` |
| 2026-09-04 | BUG-001: wishlist get-or-create race, found in live use | `817e50b` |
| 2026-09-04 | OBS-001 completed: Sentry wired server-side, PII scrubbed | `e7ae303` |
| 2026-09-04 | Audit reconciled: counts, scores, roadmap and owner tasks brought up to date | `2f0f362` |
| 2026-09-04 | OBS-001 **verified in production** — forced test proved both the `logger.error` and uncaught (`onRequestError`) paths reach Sentry; found and fixed a `SENTRY_DNS` typo that had silently disabled the SDK; temporary check route removed | `efd30c0` |
| 2026-09-04 | Re-checked against the **production database**: opened `OPS-001` (retention cron and audit log deployed but never observed running — 1,639 rate-limit rows past their window, 0 audit entries), `OBS-003` (audit log covers 2 of ~12 admin surfaces) and `REL-001` (no provider timeouts). Overall re-scored 89 → 88, Reliability 88 → 86 — implemented is not the same as running | `69e69af` |
| 2026-09-04 | Deleted the 9 seeded reviews; verified both PDPs return 200 and omit `aggregateRating` rather than emitting a zero | _(data change)_ |
| 2026-09-05 | `REL-001` closed — timeouts on Stripe, ACS and all three OAuth providers | `2f5f0b6` |
| 2026-09-05 | `OBS-003` closed — audit log widened from 2 admin surfaces to 8; `order.status_changed` finally written; activity filter lists all nine prefixes | `12502bc` |
| 2026-09-05 | `SEC-003` attempted and **stopped before any code**: Next's bundled guide states a nonce forces every page to render dynamically, disabling static generation and CDN caching — an unpriced cost on an account already over its image quota. Hash-based SRI recorded as the alternative to evaluate first. Re-scored 88 → 90 | `2317af9` |
| 2026-09-05 | `ROLLBACK.md` written — the last documented gap in deployment practice. Deployment 82 → 90, overall 90 → 91 | `b6d6d1f` |
| 2026-09-05 | **`OPS-001` confirmed broken.** The 03:30 UTC slot passed and cleared nothing — still 1,639 stale rows, oldest 22 July. Established that the retention code is correct, all three cron routes are deployed and return 401 unauthenticated, and the Vercel team is on the `hobby` plan. Cause is Vercel-side: either `CRON_SECRET` mismatches or the third cron was never scheduled. **`PRIV-001`'s GDPR position is therefore not currently being honoured** | `723700b` |
| 2026-09-05 | `OPS-001` half resolved — a manual `vercel crons run` cleared all 1,639 stale rows (2,019 → 317 total). Proves the code, the route and `CRON_SECRET` are all correct, so the remaining question is scheduling alone. `PRIV-001` is now genuinely enforced | `d922d1d` |
| 2026-09-05 | Playwright added — 18 specs across desktop and mobile covering the purchase funnel, plus browser-only regression guards for the skip link (`A11Y-001`), CSP violations (`SEC-005`) and uncaught page errors. **Found `BUG-002` on the first real run.** Testing 78 → 86 | `299ce78` |
| 2026-09-05 | `BUG-002` fixed — cart mutations await the bootstrap rather than silently dropping an early click. Verified by the same Playwright spec with no settle: fails against production, passes against the fix. Correctness 96 → 97 | `e8f486c` |
| 2026-09-05 | Browser suite extended to the cart and checkout (8 specs) and an axe WCAG 2.1 A/AA scan over six pages (6 specs) — 32 in total across desktop and mobile. **The scan found `A11Y-002` on its first run**: colour swatches carried `aria-label` on a bare `<span>`, which ARIA prohibits, so they announced as nothing. Accessibility 80 → 89, Testing 86 → 91, overall 90 → 92 | `fc8d8fc` |
| 2026-09-05 | Neon **test branch** wired in. All database tests moved off production onto it, guarded by a check that refuses to run if the URL resolves to the production endpoint (verified by pointing it at production and confirming the abort), and with email forced to the non-sending provider. `completeCheckout` covered end to end at last — ten concurrent buyers on one unit, duplicate submits, and the two incomplete-checkout refusals. TEST-001 fully closed. Testing 91 → 96, overall 92 → 93 | `cae4e0f` |
| 2026-09-05 | **Audit reconciled end to end.** Header, verdict, progress table, the "before going live" split into open/closed, and the roadmap all brought back in line — four roadmap items had been completed and were still listed as pending. Opened `PRIV-002` (GDPR access and erasure have no tooling), found by hunting for what the audit's own dimensions could not see: all ten scoring axes are engineering, so a compliance gap with no code behind it could not lower any number | `5ef8373` |
| 2026-09-05 | `PRIV-002` built and closed — GDPR access and erasure as admin actions, erasure implemented as anonymisation where tax law requires the record kept. 7 tests on the Neon branch, including the assertion that the order survives intact with the identity gone. Added a **Compliance** scoring dimension, because this finding existed only because none of the ten engineering axes could express it. Overall 93 → 94 | `4837c04` |
| 2026-09-05 | Three owner items closed and **verified**, not reported: `sslmode=verify-full` pinned (the `[error]` warning on live product pages is gone), uptime monitoring live in Sentry (9 probes, all 200), and the **backup restore drilled end to end** — branch from a past point queryable in 2.5s with data genuinely rewound. The drill surfaced a finding of its own: **point-in-time retention is only 6 hours**, so a problem noticed the next morning cannot be restored away. Deployment 90 → 94 | `c0947eb` |
| 2026-09-05 | Audit reconciled after the owner items landed: the step-by-step list, `OBS-001`'s remaining work, `OPS-001`'s evidence table and the roadmap all still described `sslmode` and the uptime monitor as pending. Observability 94 → 96 now that uptime is live and verified; overall 94 → 95. Recorded as INFO that **Neon generates every new branch's connection string with `sslmode=require`**, so the setting just pinned everywhere will keep re-appearing on new branches | `89a15ba` |
| 2026-09-05 | Sentry alert rule throttled to once per issue per day (was *notify on every trigger*), done directly in the browser. Recorded where the setting actually lives in Sentry's newer UI, since issue alerts are absent from Create Alert entirely — that cost an hour of hunting | `d7fdc02` |
| 2026-09-05 | Reliability re-scored 86 → 92. It had been marked down when the retention cron was unproven; since then `REL-001` bounded every provider call, uptime monitoring went live and was verified, and the restore path was drilled. Still short of the mid-90s for two honest reasons: no cron slot has been observed firing unaided, and there are no circuit breakers | `f81acb4` |
| 2026-09-05 | Asked why Performance was the lowest score and **measured instead of repeating the existing answer**. Opened `PERF-002`: **zero of 148 routes are prerendered**, because the root layout reads a cookie for the locale — so every page view is a serverless render with `no-store` and `X-Vercel-Cache: MISS`, TTFB ~1s warm and 4.2s cold. The rendering model of the whole site was a side effect of a localisation choice nobody weighed. This also **corrects `SEC-003`**, whose decisive argument was a cost that had already been paid months earlier | `1e08156` |
| 2026-09-05 | `PERF-002` tier 1 done (`92cf413`) — both root-layout queries cached with `updateTag` invalidation on write. **Measured afterwards: no meaningful TTFB change** (0.89–1.05s before, 0.93–1.13s after). Two queries were not the bottleneck; the serverless render is. Kept because it removes real load from a free-tier database and is a prerequisite for tier 2 — but recorded plainly as not having fixed the finding | `67a6295` |
| 2026-09-05 | `PERF-002` tier 2 **attempted and reverted**. Enabling `cacheComponents` surfaced the real scope: one trivial fix (`force-dynamic` in the health route) and one structural obstacle — `getLocale()` feeds `<html lang>` and the i18n provider, neither of which can sit behind `<Suspense>`, so **a static shell cannot know its language while the locale comes from a cookie**. Tier 2 is a localisation decision before it is a caching change. Build green, tree clean; the sanctioned adoption skill recorded for when it is taken | `e86fd99` |
| 2026-09-05 | `PERF-002` **tier 2 pre-step landed** (`34629b3`). The earlier revert was based on a wrong assumption: Cache Components ships `instant = false`, so the flag can go on with every route untouched. 82 pages and layouts opted out with TODO markers as the work queue; two sync-IO blockers fixed (the Footer's copyright year cached, the blog-post date made dynamic — the Footer one was blocking every route in the app). Nothing is faster yet, by design. Eight admin routes already report Partial Prerender | `1df03f3` |
| 2026-09-06 | Re-ran the suite to verify the count this file claims, and it **failed** — both Postgres-backed suites, in `beforeAll`, on Vitest's 10s default `hookTimeout` while Neon woke a suspended branch (collect 29.2s cold vs 5.8s warm). Passes on a re-run, which is the worst way to fail: it reads as a broken database and clears itself, so nobody investigates. Timeouts raised to 30s with the reason recorded next to them | `7043365` |
| 2026-09-06 | `OPS-001` **escalated, not closed.** Measured production again: 33 rows sat past retention through the 03:30 slot, one of them having crossed the threshold 87 minutes before it. `vercel crons ls` shows all three jobs registered and `enabled` — which **kills the plan-cron-limit hypothesis** this file had been carrying, and which it had already flagged as recalled rather than verified. With `CRON_SECRET` cleared earlier by the manual run, every proposed cause is now eliminated: the job is correct, deployed, authorized, scheduled, enabled, and does not fire. Next step is Vercel, not code | `7043365` |
| 2026-09-06 | Corrected the still-open list, which was still citing the CSP-nonce argument `PERF-002` disproved, and did not list per-route Cache Components adoption as open at all | `7043365` |
| 2026-09-06 | **Re-measured performance instead of trusting the score, and the audit was wrong in the shop's favour.** `PERF-002`'s tier 2 pre-step was recorded twice as a deliberate no-op; it was not. Warm TTFB is **0.20–0.42s** against the 0.89–1.13s recorded the day before — three- to fivefold — because enabling Cache Components dropped `no-store`, letting Vercel's edge hold the HTML. Verified against the obvious objection: three never-requested pages answered `PRERENDER` with `Age: 0`. Performance re-scored **74 → 85**, the first move made on measurement rather than reasoning. A build/edge discrepancy is recorded unresolved rather than explained away | `ed460cc` |
| 2026-09-06 | `PERF-003` opened — the homepage carries 2.68 MB of images, of which 1.98 MB is JPEG averaging 135 KB while 14 WebPs in the same bucket average 51 KB. Converting them is ~1.2 MB and needs no plan change, which makes it the only open performance item blocked on nobody. Also records a suspicion that did **not** survive checking: the LCP image is not lazy-loaded | `ed460cc` |
| 2026-09-06 | **Reliability lowered 92 → 88.** Its justification credited "scheduled retention" while `OPS-001` shows the schedule does not run. A job that works only when a human remembers to trigger it is not a reliability feature, and scoring it as one was the error this file exists to catch | `3911be7` |
| 2026-09-06 | **Overall corrected 95 → 92, on arithmetic rather than new bad news.** The *Before* column is the mean of its ten dimensions (73.2 → 74); *Now* read 95 against a mean of 92.3, so one column held two numbers produced two different ways. Recorded the rule under the table so a future edit recomputes rather than re-feels it. Also corrected the P3 counts for `PERF-003`, and the claim that the open P3s were all spending decisions — one of them needs no permission from anyone | `3911be7` |
| 2026-09-06 | **`PERF-003` done, and it was twenty times bigger than the finding said.** Scoped from the homepage's 15 JPEGs; the catalogue held **311**. 309 converted to WebP at q85, **32.39 MB → 15.61 MB (52% saved)**, 0 failures. Quality measured rather than assumed — PSNR 42.7–48.9 dB — and **q95 rejected on evidence**, since it produced files larger than the JPEGs it replaced. A 10%-minimum-saving guard refused 2 images, one of which would have grown 416 KB → 418 KB. Originals kept, column backup taken, 315 references rewritten in one transaction, 64 images verified unbroken afterwards | `28f9630` |
| 2026-09-06 | **`SEO-002` opened** — unknown product, category and collection URLs answer **200** instead of 404, because a prerendered shell commits its status line before `notFound()` runs. Regressed at `34629b3`. Cause read from Next's bundled guide rather than guessed. **My first reading was wrong**: I said Google would index the phantom pages, and it will not — Next injects `noindex`, which I then verified against production. Left unfixed deliberately (it changes how three high-traffic routes render) and held visible with `test.fail()` rather than a weakened assertion | `28f9630` |
| 2026-09-06 | Browser suite: fixed an assertion that was quietly wrong. `page.locator("h1")` matched **two** elements after a soft navigation, because the router keeps the previous page mounted as a second `<main>` with `display: none`. Checked rather than assumed — the hidden copy is out of the accessibility tree and the server HTML has one `<h1>`, so no user or crawler ever sees two. Now asserts on the *visible* heading. Also pinned the `noindex` mitigation as its own test | `28f9630` |
| 2026-09-06 | Corrected the test counts, which said **40 browser specs** in both this file and the published artifact when there are **42**, and recorded the reason the suite no longer passes in one run: a ~9 minute pass runs desktop before mobile and outlives the shop's own 60-per-10-minute `cart-create` window, so mobile cart specs fail against a limiter doing its job. Written up as a standing rule beside the "shipped is not working" one, because it has now cost two investigations | `dff04e9` |
| 2026-09-06 | Widened the recorded TTFB from **0.17–0.24s** to **0.20–0.42s**. The first figure was taken in one burst right after the measurement that produced it; a wider sample later the same day, after the WebP migration and a fresh deploy, spread higher, with one 0.81s outlier while Neon was waking. The conclusion and the score are unchanged — it is still three- to fivefold better than the 0.89–1.13s baseline — but the range as written was the flattering end of the evidence, which is the error this document keeps catching in itself | `8322b3c` |
| 2026-09-06 | **`SEO-002` fixed**, and not where the guide pointed. The documented fix — check existence before the stream starts — is unavailable here, because the *shell* starts the stream, not the page: the status is committed before the page component runs at all. So the 404 moved to `proxy.ts`, which is where this codebase had already solved the same problem for renamed-slug 308s, and whose comment already said why. **No extra query on two of the three routes** — the lookup that decides a redirect also decides existence. Visibility rules mirrored rather than re-invented, so a hidden category and a draft product now return a hard 404 instead of a soft one. Verified on a local production build before deploying | `5732d95` |
| 2026-09-07 | Restored `noindex` on the 404 page, which fixing `SEO-002` had silently removed. Next injects it only when `notFound()` fires mid-stream; routing the 404 through the proxy means it never fires. The status code more than replaces the tag, but it was lost as a **side effect of a fix** rather than by decision — caught by the one test written to pin the old mitigation, which is the argument for pinning mitigations even when they look redundant | `45dc8cb` |
| 2026-09-07 | **`PERF-002` adoption attempted and reverted, second time — but the documented blocker is gone.** The owner chose the Greek-static shell; the locale came out of the root layout, a client provider took over the swap, and the language switcher moved off a server action that had stopped being able to work. Then the build named the *next* blocker: a root-layout read that is already `"use cache"` still counts as uncached during prerender. Undiagnosed, so reverted rather than shipped half-done. Also measured the real scope: of 77 opt-outs, **47 are admin pages that do not want PPR** and 25 storefront pages each need their own conversion — the layout fix unblocks **5**, including the homepage. And corrected `i18n/config.ts`, which claims categories and collections have no translation columns: they do, fully populated | `7e9cb56` |
| 2026-09-07 | **`PERF-004` opened and fixed** — the owner noticed adding to the cart felt slow and asked why. It was: **1245ms warm, 2931ms cold, over eight sequential round trips**, two of which bought nothing. Nine cart mutations opened with a full cart read they discarded, and each already re-read the cart at the end. Fixed with a cheap existence check, one parallelised pair, and a non-blocking rate-limit write — checked first that no credential path uses that helper. **~1245ms → ~1045ms**, measured. I predicted 400ms and got 200ms; parallelising two queries saves the shorter one, not a round trip | `570fdba` |
| 2026-09-07 | **Diagnosed why `PERF-002` stalled, and the previous entry was wrong.** `"use cache"` was never being rejected: Next's prerender error names the **nearest render position**, not the actual uncached access, so it kept pointing at a cached layout call. Bisected on a throwaway build — caching the homepage's four reads moved the error *past* all of them to the real blocker, `SectionRenderer.tsx:27` calling `getLocale()`. That also corrects the "5 locale-free routes" figure, which was grepped from page files and missed component-level locale reads. `PERF-002` is now ordinary work: `"use cache"` is in **1 of 48** service files | `06292e7` |
| 2026-09-07 | **`PERF-002` recorded as a deliberate deferral, not open work.** Measured first: three routes the build classifies as `ƒ Dynamic` all serve in **~0.2–0.3s** from the edge — the CDN is already doing what Partial Prerendering would, because the pre-step dropped `no-store`. Adoption would improve only the **cache-miss** path (~0.7–0.84s), which is a minority of views and shrinks as traffic grows, at the cost of a services-layer migration on a live shop. Deferred with two triggers: traffic making misses material, or products getting translated — which forces the locale decision anyway. Also notes that `OPS-001` is the one item left that is actually *wrong* rather than a choice | `8afdb47` |
| 2026-09-07 | **`OPS-001`: the marker test was invalid, the third slot failed, and retention stopped depending on the scheduler.** The 33 rows this file left as its discriminator can be deleted by `lib/rate-limit.ts`'s own 1-day prune — the same prune the entry had already dismissed as a confound, then used as evidence anyway. What settles it is a row that *survived*: 198 rows sat past retention four hours after the 03:30 slot, the oldest of them two days old before it. Three more explanations eliminated — the plan cron limit (Vercel documents **100 per project on every plan**, killing the guess this file carried), a cached response masking the run (`X-Vercel-Cache: MISS`), and redeploy churn (nothing deployed for the six hours spanning the slot). Shipped: `services/cron-runs.ts`, so all three jobs record when they ran and **what triggered them**, surfaced on `/api/health`; and `runDataRetentionIfDue`, which runs the full pass from ordinary traffic when a day passes with no recorded run, replacing a 1%-chance prune that had an expected 0.6 firings on a 61-request day. Scores deliberately unchanged — none of it has been observed running yet | `3c8805d` |
| 2026-09-07 | **`OPS-001` de-escalated: the evidence of continued failure was three measurement defects.** `email-followups` has sent mail at 08:56, 08:57, 08:03, 08:32 and 08:56 UTC on five dates — every one inside the hour of its `0 8 * * *` slot, which is textbook Hobby behaviour. **Vercel's scheduler works on this project**, killing the "no cron fires here" reading. The three defects: the marker test could not discriminate (the rate limiter's prune deletes the same rows); **a non-zero overdue count is the steady state of a working daily job**, not a failure — 33 rows and 198 rows were what a healthy job produces; and node-postgres reads `TIMESTAMP` columns in the *client's* zone, so every printed instant was three hours early, which alone flipped the 09-07 conclusion (the oldest row was 04:55, not 01:55 — newer than the slot's cutoff and supposed to survive). The 09-05 finding survives untouched: 1,639 rows, oldest 45 days, was real. What is left is that the schedule has never been *observed*, which the run log answers at the next slot. Also: the fallback shipped that morning was **verified in production** — 492 overdue rows to 0 with no human involved | `5409adc` |
| 2026-09-07 | **`BUG-003` opened and fixed: the e2e suite was making the shop send real mail to `e2e-test@example.com`.** Found while establishing that the `email-followups` cron fires — the four sends that proved it were all to a reserved address. The browser suite runs against production by design and its checkout spec writes that email; a day later abandoned-cart recovery mails it through Resend, and `example.com` is reserved by RFC 2606 so every one is a guaranteed hard bounce. That is a slow leak in the shop's ability to deliver **order confirmations**, since bounce rate is what mailbox providers and Resend score a sender on. Two more were pending for the next 08:00 slot. Guarded at the provider boundary (`isUndeliverableAddress`), which skips rather than throws so the cart is marked handled instead of retried daily forever. 21 tests, weighted toward the false-positive side — a misclassified customer silently loses their confirmation, which is far worse than one bounce. Second time test data has reached a live business flow here (`QA-012` was six `example.com` orders worth EUR 1,196.43); orders holding a reserved address today: **0** | `f9b4560` |
| 2026-09-07 | **`purge-e2e-data` run: 146 of 516 carts removed** — 6 carrying a test/QA checkout and 140 empty guest carts over a week old. Verified afterwards rather than trusting the summary, which is what turned up **`BUG-004`**: one order's `checkoutId` resolves to nothing. Not caused by the purge (`completeCheckout` copies the checkout's email onto the order, and that order's address is real, so it cannot have come from any of the six reserved-address checkouts deleted). The mechanism is `mergeCarts`, which deletes the guest cart on sign-in and cascades its checkouts away — including ones an order points at, because `Order.checkoutId` has no foreign key while `checkouts.cartId` cascades. No impact today: `Order` carries its own snapshots of line items, totals and both addresses, and nothing joins back. The hazard was the **comment** calling that pointer permanent, since code gets written against documented guarantees; corrected, mechanism left open as a decision | `02add7d` |
| 2026-09-07 | **`BUG-004` fixed at the merge.** `mergeCarts` now **empties** a guest cart whose checkout an order points at, instead of deleting it and cascading that order's session row away. Emptying rather than merely keeping is the part that is easy to miss: the cascade was doing two jobs, removing the row *and* its line items, so leaving them would hand the shopper their basket twice — the guard clears the same three tables `clearCart` does. Two extra round trips, and only on carts that have ever reached checkout. Pinned by `services/cart-merge.test.ts`, **checked to fail against the pre-fix code** rather than assumed to cover it, and asserting both directions, since a guard that never deleted anything would pass a one-sided test while leaking a cart row on every sign-in. The foreign key (`ON DELETE RESTRICT`) is still the correct answer and is deliberately deferred: it needs a hand-applied migration on a live shop and turns a silent harmless outcome into a failed sign-in — worth doing next time a migration is being applied anyway. The one existing dangling pointer is left as it is; repointing it would invent a session that never existed | `34b5aa4` |
| 2026-09-07 | **Scores moved for the first time on observation rather than on shipping.** Reliability **88 → 91**, Observability **96 → 98**, Compliance **88 → 91**, Testing **96 → 97**; overall **92 → 93** (1024/11 = 93.09). Reliability and Compliance had been frozen that morning with the reason written down — "it moves when the run log shows it working" — and moved only after the deployed `/api/health` was read back serving `staleCronJobs` and an unattended retention pass cleared 492 overdue rows to zero. Not restored to their pre-`OPS-001` values: a traffic-driven fallback is genuinely weaker than a schedule, since a shop with no visitors for two days does not run retention. Also records the **ACS courier integration** as INFO — request side verified against ACS's published spec, response side unverifiable from it, and a 3-character `ACS_API_KEY` placeholder that would defeat the half-configured fallback if anyone set `COURIER_PROVIDER=acs` today — and retires the stale "rate-limit pruning is opportunistic, harmless" INFO bullet, which was neither | `70e1a60` |
| 2026-09-08 | **A day shaped by the owner using the shop, not by remediation** — eighteen commits, ten of them from looking at a screen and saying what was wrong with it. Two money-or-data defects (gift wrap chargeable with no way to remove it; a stored shipping rate never re-priced when the address changed), three places the Greek shop still spoke English, ΑΦΜ autofill against AADE, customer delivery notes, and a toast fix that was reverted before it was fixed. All three `OPS-001` crons observed running on the scheduler. Narrated in full under **What shipped — 2026-09-08** | *see section* |
| 2026-09-08 | **`knip` added, and the cheapest possible pass found the most expensive thing.** A question about model choice for bug-hunting was answered by running a dead-code tool instead. 146 lines of report, five that mattered. `lib/password.ts` documented a shared bcrypt work factor that was shared by nobody — six call sites, five separate literals, and **two timing defences that silently stop equalising the moment anyone raises one of them**. `@prisma/config` was imported by `prisma.config.ts` and never declared, resolving only transitively, which makes a Vercel clean install a failed deploy waiting for a hoisting change. Configured rather than run bare: unconfigured it called all 34 `scripts/` CLI tools dead and then reported `sharp` unused as a consequence | `96680c6`, `9dc3906` |
| 2026-09-08 | **`PRIV-002` re-opened and re-closed: the fix had no caller for three days.** The service, both actions, the capability gate, the audit entries and seven passing tests all shipped on 5 September, and nothing imported them — so the finding's own headline, *no way to answer a GDPR access or erasure request*, stayed literally true while this file listed it as fixed. Found by `knip` reporting the actions file unused; not by `tsc`, `eslint`, the seven tests, or four days of reading this document. Now two forms on `/admin/customers` behind `admin:settings`, working from an email address rather than a table row so guests and newsletter subscribers are reachable. **This file's own standing rule caught this file:** `Fixed` means shipped, not working. Compliance held at 91 rather than raised — correcting an overstatement earns no points | `663b22a` |
