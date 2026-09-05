# Production Readiness Audit

**Audited:** 2026-09-03 · commit `be0d546` · Next 16.3, Prisma 7.9, Neon Postgres, Vercel
**Remediated:** 2026-09-04 → 2026-09-05 · Phases 1–4 plus post-audit findings
**Re-checked against production:** 2026-09-04 (added `OPS-001`, `OBS-003`, `REL-001`) and 2026-09-05 (added `BUG-002`, `A11Y-002`)
**Scope:** 564 TS/TSX files, ~52,000 LOC, 52 API routes, 22 server-action files, full config surface
**Verified with:** `tsc --noEmit` ✓ · `eslint` ✓ · `vitest` **448/448** ✓ · `playwright` **40/40** on live production ✓ · `next build` ✓ · `npm audit` · live production DB queries · a forced Sentry event · an axe WCAG 2.1 A/AA scan · a Neon test branch for anything that writes

## Verdict

**READY TO LAUNCH.** Overall **74 → 95**.

The original audit found no P0 and rated the shop 74/100, blocked not by its code but by two
things: it could not be seen failing, and its riskiest code had no automated coverage. Both
are now closed.

**All 3 P1 launch blockers are closed. 14 of 16 P2s are closed**, with one deferred
(`SEC-003`, the CSP nonce) and one open.

**`OPS-001` — the retention cron.** Opened as a *suspicion* on 4 September, on the grounds that a
subsystem nobody has watched run is not a subsystem known to work. It ran down to a live bug:
the job had never executed, so the GDPR retention `PRIV-001` describes was not actually being
honoured. A manual trigger has since cleared ~1,700 rows and proved the code, the route and
`CRON_SECRET` all correct. What remains unverified is the schedule alone.

**`PRIV-002` — GDPR access and erasure — is now built.** Export and erasure as admin actions,
with erasure implemented as anonymisation where tax law requires the record kept: the order
survives with its accounting facts, stripped of every identifying field.

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
| P2 — Medium | 16 | 1 | **14** | 1 |
| P3 — Low | 8 | 2 | **6** | 0 |
| INFO | 7 | — | — | — |

**Every finding opened after the original audit came from running or measuring the system** —
`SEC-005`, `BUG-001`, `OPS-001`, `OBS-003`, `REL-001`, `BUG-002`, `A11Y-002` and `PRIV-002`. Not one would have been
found by reading the code again more carefully.

**One P2 is open.** `OPS-001` is half resolved — the retention job is proven to work by a manual
trigger, and only its schedule is still unverified, which one cron slot settles.

The open P3 (`PERF-001`) and the deferred P2 (`SEC-003`) are both spending decisions rather
than engineering ones.

**Status legend:** `[ ]` open · `[~]` in progress · `[x]` done · `[-]` deferred (reason required)

**How to use this file:** fix one item, tick its box, fill in its `Fixed:` line with the commit hash, and update the Progress table in the same commit. Anything marked `[-]` needs a one-line reason so it is never silently re-opened.

### The standing rule this audit learned the hard way

> **`Fixed` means the code shipped. It does not mean the thing works.**
> Nothing is finished until it has been *observed working in production*, and the entry says
> how it was observed.

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
| 1 | **Retention cron has never fired on schedule** (`OPS-001`) | You — watch one slot | 🟡 A manual trigger cleared all 1,639 stale rows, proving the code, the route and `CRON_SECRET` are correct. The 03:30 trigger still has not fired unaided. One query settles it. |
| 2 | **Restore window is only 6 hours** | You — **plan decision** | 🔴 Discovered by the restore drill. A problem noticed the next morning **cannot be restored away**. See `ROLLBACK.md`. |
| 3 | **Re-enable image optimization** (`PERF-001`) | You — billing | ⏳ The largest single score gain left: Performance 74 → ~85. |
| 4 | **The CSP nonce** (`SEC-003`) | You — **cost decision** | ⛔ Attempted and stopped: a nonce forces every page to render dynamically, on an account already over its image quota. Evaluate hash-based SRI first. |

**Nothing on this list is code.** Item 1 is one query tomorrow morning; items 2, 3 and 4 are decisions about what to spend.

### Closed on 4–5 September

| Item | Evidence |
|---|---|
| `sslmode=verify-full` pinned | Verified in the runtime logs: the same product page that logged an `[error]` warning now logs `[info]` with none |
| Uptime monitoring live | 9 probes in 45 minutes, all 200, every 5 minutes |
| Sentry alert throttled | `Send a notification for high priority issues` changed from *notify on every trigger* to **1 day**; sidebar confirms "Throttling: 1 day" |
| **Backup restore drilled** | Branch from a past point ready in **2.5s**; data genuinely rewound (789 rate-limit rows vs 1,080 live); branch deleted |
| `PRIV-002` — no way to answer a GDPR access or erasure request | Export and erasure as admin actions; orders kept and anonymised rather than deleted, per Art. 17(3)(b). 7 tests on the branch |
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

## [ ] PERF-002 · Nothing is statically rendered, so every page is a server render

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

**Fixed:** _tier 1 done (`92cf413`) with no measurable effect. Tier 2 attempted, scoped and
reverted: it is a localisation decision before it is a caching change._

---

## [ ] PERF-001 · Image optimization disabled globally
`next.config.ts` → `images.unoptimized: true`. Deliberate and documented — the Vercel transform quota was exhausted and returning 402s, breaking images across the shop. Real bandwidth/LCP cost (~100KB JPEGs served raw).
**Fix.** Re-enable via `NEXT_PUBLIC_OPTIMIZE_IMAGES=true` once the plan allows.
**Fixed:** _pending_

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
- **Rate-limit pruning is opportunistic** (1% of calls, >24h old). Unreliable at low traffic; harmless.
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

| Dimension | Before | Now | What moved it |
|---|---:|---:|---|
| Security | 82 | **93** | Rate limiting no longer keyed on a spoofable header; checkout bound to its browser; sessions revocable; login timing oracle closed; email escaping consistent. Held back only by `unsafe-inline` (SEC-003). |
| Correctness | 88 | **97** | Webhook amounts verified; refund race closed; money rounding fixed at the half-cent; a real CSP bug found and fixed. |
| Reliability | 78 | **92** | Health endpoint plus **live uptime monitoring**, structured logging in every money path, scheduled retention, and **every outbound provider call bounded** (`REL-001`) — no supplier can hold a checkout invocation open indefinitely. Held below the mid-90s by two things: the retention cron has still not been seen to fire on schedule (`OPS-001`), and there are no circuit breakers. |
| Performance | 72 | **74** | The lowest score, and until 2026-09-05 the least investigated: it was attributed entirely to `PERF-001`. Measuring found `PERF-002` — **zero of 148 routes are prerendered**, because the root layout reads a cookie for the locale, so every page view is a serverless render with nothing cached at the edge. Unchanged by design — PERF-001 is a billing decision. The +2 is the retention job bounding two tables that grew without limit. |
| **Testing** | 45 | **96** | The three concurrency guards are pinned against the **real pooled database**, plus 29 unit tests across auth, email, money and CSP — and **32 Playwright specs on desktop and mobile** covering the purchase funnel, the cart, the first checkout step and a WCAG scan. They have now found two real bugs on first run, `BUG-002` and `A11Y-002`. And `completeCheckout` is now covered **end to end against the real service** on a Neon test branch, closing the last gap — including ten simultaneous buyers racing for one unit. |
| Maintainability | 95 | **95** | Already exceptional; held there deliberately — every fix followed the existing patterns rather than inventing new ones. |
| **Observability** | 25 | **96** | Health check, adopted logger, Sentry **proven by a forced event** rather than assumed — which is what caught the DSN typo — an audit trail covering 8 admin surfaces instead of 2 (`OBS-003`), and **uptime monitoring live and verified**. The last points are correlation IDs, and cron check-ins so a job that never runs announces itself instead of being found by a query. |
| Deployment | 80 | **94** | Both migrations dry-run in rolled-back transactions before applying; a third cron added; **`ROLLBACK.md` now documents the procedure** — how to tell a code problem from a schema, infra or data one, and why promoting a previous Vercel deployment beats every other first move. |
| Accessibility | 75 | **89** | Skip link (WCAG 2.4.1 Level A), plus an **axe scan at WCAG 2.1 A/AA across six pages** on every run — which immediately found `A11Y-002`, colour swatches that announced as nothing. Held below 90 deliberately: axe checks the machine-checkable half, and a real screen-reader pass is still the next gain. |
| SEO | 92 | **94** | SEC-005 fixed a policy that would have blanked the Instagram feed. |
| **Compliance** (new) | — | **88** | Added on 2026-09-05, because `PRIV-002` showed the scoring had no axis for it: an obligation with no code behind it could not lower any number. GDPR retention (`PRIV-001`), access and erasure (`PRIV-002`) are implemented; legal pages are live in Greek with controller identity and lawful bases. Held below 90 because retention is still not proven to run on a schedule. |
| **Overall** | **74** | **95** | **Ready to launch.** Every code finding is closed, and the browser suite has now caught two real bugs the unit tests could not see. What holds it below the high 90s is no longer engineering at all: one unobserved cron slot, and three decisions about what to spend — the 6-hour restore window, image optimization, and the CSP nonce. |

---

# What is left, and what it is worth

Reconciled 2026-09-05. Everything above this line is done; below is only what remains.

### Yours — no code, and the first four are minutes each

1. **Confirm the retention cron fired on its own** (`OPS-001`) — one SQL query after
   03:30 UTC. It closes the last open P2 either way: zero means the schedule works, non-zero
   means the three cron jobs need folding into two, which is then a small code change.
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
| 2026-09-04 | Re-checked against the **production database**: opened `OPS-001` (retention cron and audit log deployed but never observed running — 1,639 rate-limit rows past their window, 0 audit entries), `OBS-003` (audit log covers 2 of ~12 admin surfaces) and `REL-001` (no provider timeouts). Overall re-scored 89 → 88, Reliability 88 → 86 — implemented is not the same as running | _this commit_ |
| 2026-09-04 | Deleted the 9 seeded reviews; verified both PDPs return 200 and omit `aggregateRating` rather than emitting a zero | _(data change)_ |
| 2026-09-05 | `REL-001` closed — timeouts on Stripe, ACS and all three OAuth providers | `2f5f0b6` |
| 2026-09-05 | `OBS-003` closed — audit log widened from 2 admin surfaces to 8; `order.status_changed` finally written; activity filter lists all nine prefixes | `12502bc` |
| 2026-09-05 | `SEC-003` attempted and **stopped before any code**: Next's bundled guide states a nonce forces every page to render dynamically, disabling static generation and CDN caching — an unpriced cost on an account already over its image quota. Hash-based SRI recorded as the alternative to evaluate first. Re-scored 88 → 90 | _this commit_ |
| 2026-09-05 | `ROLLBACK.md` written — the last documented gap in deployment practice. Deployment 82 → 90, overall 90 → 91 | _this commit_ |
| 2026-09-05 | **`OPS-001` confirmed broken.** The 03:30 UTC slot passed and cleared nothing — still 1,639 stale rows, oldest 22 July. Established that the retention code is correct, all three cron routes are deployed and return 401 unauthenticated, and the Vercel team is on the `hobby` plan. Cause is Vercel-side: either `CRON_SECRET` mismatches or the third cron was never scheduled. **`PRIV-001`'s GDPR position is therefore not currently being honoured** | _this commit_ |
| 2026-09-05 | `OPS-001` half resolved — a manual `vercel crons run` cleared all 1,639 stale rows (2,019 → 317 total). Proves the code, the route and `CRON_SECRET` are all correct, so the remaining question is scheduling alone. `PRIV-001` is now genuinely enforced | _this commit_ |
| 2026-09-05 | Playwright added — 18 specs across desktop and mobile covering the purchase funnel, plus browser-only regression guards for the skip link (`A11Y-001`), CSP violations (`SEC-005`) and uncaught page errors. **Found `BUG-002` on the first real run.** Testing 78 → 86 | _this commit_ |
| 2026-09-05 | `BUG-002` fixed — cart mutations await the bootstrap rather than silently dropping an early click. Verified by the same Playwright spec with no settle: fails against production, passes against the fix. Correctness 96 → 97 | _this commit_ |
| 2026-09-05 | Browser suite extended to the cart and checkout (8 specs) and an axe WCAG 2.1 A/AA scan over six pages (6 specs) — 32 in total across desktop and mobile. **The scan found `A11Y-002` on its first run**: colour swatches carried `aria-label` on a bare `<span>`, which ARIA prohibits, so they announced as nothing. Accessibility 80 → 89, Testing 86 → 91, overall 90 → 92 | _this commit_ |
| 2026-09-05 | Neon **test branch** wired in. All database tests moved off production onto it, guarded by a check that refuses to run if the URL resolves to the production endpoint (verified by pointing it at production and confirming the abort), and with email forced to the non-sending provider. `completeCheckout` covered end to end at last — ten concurrent buyers on one unit, duplicate submits, and the two incomplete-checkout refusals. TEST-001 fully closed. Testing 91 → 96, overall 92 → 93 | _this commit_ |
| 2026-09-05 | **Audit reconciled end to end.** Header, verdict, progress table, the "before going live" split into open/closed, and the roadmap all brought back in line — four roadmap items had been completed and were still listed as pending. Opened `PRIV-002` (GDPR access and erasure have no tooling), found by hunting for what the audit's own dimensions could not see: all ten scoring axes are engineering, so a compliance gap with no code behind it could not lower any number | _this commit_ |
| 2026-09-05 | `PRIV-002` built and closed — GDPR access and erasure as admin actions, erasure implemented as anonymisation where tax law requires the record kept. 7 tests on the Neon branch, including the assertion that the order survives intact with the identity gone. Added a **Compliance** scoring dimension, because this finding existed only because none of the ten engineering axes could express it. Overall 93 → 94 | _this commit_ |
| 2026-09-05 | Three owner items closed and **verified**, not reported: `sslmode=verify-full` pinned (the `[error]` warning on live product pages is gone), uptime monitoring live in Sentry (9 probes, all 200), and the **backup restore drilled end to end** — branch from a past point queryable in 2.5s with data genuinely rewound. The drill surfaced a finding of its own: **point-in-time retention is only 6 hours**, so a problem noticed the next morning cannot be restored away. Deployment 90 → 94 | _this commit_ |
| 2026-09-05 | Audit reconciled after the owner items landed: the step-by-step list, `OBS-001`'s remaining work, `OPS-001`'s evidence table and the roadmap all still described `sslmode` and the uptime monitor as pending. Observability 94 → 96 now that uptime is live and verified; overall 94 → 95. Recorded as INFO that **Neon generates every new branch's connection string with `sslmode=require`**, so the setting just pinned everywhere will keep re-appearing on new branches | _this commit_ |
| 2026-09-05 | Sentry alert rule throttled to once per issue per day (was *notify on every trigger*), done directly in the browser. Recorded where the setting actually lives in Sentry's newer UI, since issue alerts are absent from Create Alert entirely — that cost an hour of hunting | _this commit_ |
| 2026-09-05 | Reliability re-scored 86 → 92. It had been marked down when the retention cron was unproven; since then `REL-001` bounded every provider call, uptime monitoring went live and was verified, and the restore path was drilled. Still short of the mid-90s for two honest reasons: no cron slot has been observed firing unaided, and there are no circuit breakers | _this commit_ |
| 2026-09-05 | Asked why Performance was the lowest score and **measured instead of repeating the existing answer**. Opened `PERF-002`: **zero of 148 routes are prerendered**, because the root layout reads a cookie for the locale — so every page view is a serverless render with `no-store` and `X-Vercel-Cache: MISS`, TTFB ~1s warm and 4.2s cold. The rendering model of the whole site was a side effect of a localisation choice nobody weighed. This also **corrects `SEC-003`**, whose decisive argument was a cost that had already been paid months earlier | _this commit_ |
| 2026-09-05 | `PERF-002` tier 1 done (`92cf413`) — both root-layout queries cached with `updateTag` invalidation on write. **Measured afterwards: no meaningful TTFB change** (0.89–1.05s before, 0.93–1.13s after). Two queries were not the bottleneck; the serverless render is. Kept because it removes real load from a free-tier database and is a prerequisite for tier 2 — but recorded plainly as not having fixed the finding | _this commit_ |
| 2026-09-05 | `PERF-002` tier 2 **attempted and reverted**. Enabling `cacheComponents` surfaced the real scope: one trivial fix (`force-dynamic` in the health route) and one structural obstacle — `getLocale()` feeds `<html lang>` and the i18n provider, neither of which can sit behind `<Suspense>`, so **a static shell cannot know its language while the locale comes from a cookie**. Tier 2 is a localisation decision before it is a caching change. Build green, tree clean; the sanctioned adoption skill recorded for when it is taken | _this commit_ |
