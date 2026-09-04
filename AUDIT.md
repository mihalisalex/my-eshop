# Production Readiness Audit

**Audited:** 2026-09-03 · commit `be0d546` · Next 16.3, Prisma 7.9, Neon Postgres, Vercel
**Remediated:** 2026-09-04 · Phases 1–4 complete · `782d243` → `c731ab0` → `493ae9c` → `03ad4c4` → `4684a25` → `817e50b` → `e7ae303` → `efd30c0`
**Re-checked against production:** 2026-09-04 — added `OPS-001`, `OBS-003`, `REL-001`
**Scope:** 564 TS/TSX files, ~52,000 LOC, 52 API routes, 22 server-action files, full config surface
**Verified with:** `tsc --noEmit` ✓ · `eslint` ✓ · `vitest` 436/436 ✓ · `next build` ✓ · `npm audit` · live production DB queries · a forced Sentry event · real-browser checks

## Verdict

**READY TO LAUNCH.** Overall **74 → 90**.

The original audit found no P0 and rated the shop 74/100, blocked not by its code but by two
things: it could not be seen failing, and its riskiest code had no automated coverage. Both
are now closed.

**All 3 P1 launch blockers are closed. 12 of 14 P2s are closed.** The one still open
(`OPS-001`) is a verification waiting on a cron cycle, not a defect. The one deferred
(`SEC-003`, the CSP nonce) turned out to carry a cost nobody had priced — see its entry.

**Every remaining item needs an account, a setting, or money. None of it is code.**

**Three findings were discovered by running the system, not by auditing it** — `SEC-005`,
`BUG-001`, and the `SENTRY_DNS` typo that had silently disabled all error reporting. That last
one is the reason `OPS-001` now exists: `Sentry.init` treats a missing DSN as *disabled* rather
than an error, so the shop looked fully instrumented while reporting nothing, and only a forced
test event exposed it. The same "wired, plausible, never actually observed" condition applies
right now to the retention cron and the admin audit log.

> With bank-transfer only + manual reconciliation: **ready.**
> Before enabling card payments: PAY-001 is fixed, so that gate is open too.

The honest lesson of this exercise: **a clean read is not the same as a clean run.** Every
finding added after the original audit came from running or measuring the system, and none
would have been caught by reading the code again more carefully.

---

## Progress

| Severity | Total | Open | Done | Deferred |
|---|---:|---:|---:|---:|
| P0 — Critical | 0 | 0 | 0 | 0 |
| P1 — Launch blocker | 3 | 0 | **3** | 0 |
| P2 — Medium | 14 | 1 | **12** | 1 |
| P3 — Low | 6 | 1 | **5** | 0 |
| INFO | 6 | — | — | — |

All three P2s opened on 2026-09-04 came from measuring production rather than re-reading code.
`REL-001` and `OBS-003` are closed. **The single open P2 is `OPS-001`, which is verification
rather than a defect** — it closes when one cron cycle has been observed, not when code changes.

The one open P3 (`PERF-001`) and the deferred P2 (`SEC-003`) are both spending decisions.

**Status legend:** `[ ]` open · `[~]` in progress · `[x]` done · `[-]` deferred (reason required)

**How to use this file:** fix one item, tick its box, fill in its `Fixed:` line with the commit hash, and update the Progress table in the same commit. Anything marked `[-]` needs a one-line reason so it is never silently re-opened.

---

## Before going live — what is actually left

Ordered by what would hurt most if skipped. Nothing here is a P0, and the shop is already
taking real orders (**6** in the database), so treat this as hardening rather than a gate.

**Every code item is now closed.** What remains needs an account, a setting, or a decision
that costs money — none of it can be done from the repository.

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | **Verify the retention cron actually runs** (`OPS-001`) | You — one query | ⏳ Cron first fires 03:30 UTC. Still **1,639** stale rows as of 22:19 UTC. |
| 2 | **Narrow the Sentry alert rule** | You — setting | ⏳ Default is "email on every new issue". A muted alert is no alert. |
| 3 | **Uptime monitor on `/api/health`** | You — account | ⏳ Sentry reports what *throws*; it cannot report a site that is down. |
| 4 | ~~Delete the 9 seeded fake reviews~~ | — | ✅ **Done** 2026-09-04. All 9 removed, both product pages verified. |
| 5 | ~~Timeouts on payment/courier calls~~ (`REL-001`) | — | ✅ **Done** `2f5f0b6`. Widened to OAuth too. |
| 6 | ~~Widen the admin audit log~~ (`OBS-003`) | — | ✅ **Done** `12502bc`. 2 surfaces → 8. |
| 7 | **Pin `sslmode=verify-full`** | You — Vercel env | ⏳ `pg` warns the current value will silently weaken in v9. |
| 8 | **Re-enable image optimization** (`PERF-001`) | You — billing | ⏳ Biggest single score gain available (Performance 74 → ~85). |
| 9 | **SEC-003, the CSP nonce** | You — **cost decision** | ⛔ Attempted and stopped. A nonce forces **every page to render dynamically**, disabling static generation and CDN caching — on an account already over its image quota. See the entry. |

**The honest summary:** items 1, 2, 3 and 7 are about half an hour of clicking and are worth
more than any code that was left. Items 8 and 9 are both spending decisions rather than
engineering ones, and 9 is the one to *not* rush.

**On the deletion in item 4:** it went through the database directly, before `OBS-003` shipped,
so nothing recorded it. That is a small demonstration of the finding rather than an accident —
the next review deletion will leave an entry naming the actor, the rating and the product.

---

### The exact steps for the no-code items

Detail for rows 1–4, 7 and 8 of the table above — the settings, values and commands, so none
of it has to be reconstructed later.

1. **Retention cron** (`OPS-001`). Confirm `CRON_SECRET` is set in Vercel. It is already
   required by the two existing crons, so if `email-followups` and `instagram-token` run, this
   one will too. After 03:30, run:
   ```sql
   SELECT COUNT(*) FROM rate_limit_attempts WHERE "createdAt" < now() - interval '2 days';
   ```
   `0` means it worked. Anything else means it did not run — check the Vercel cron logs before
   assuming the code is wrong.

2. **Sentry alert rule.** Replace the default. Notify immediately when the event message or
   tags point at the payment or webhook paths; send everything else to a daily digest. The
   principle: page on money, digest on everything else.

3. **Uptime monitor.** Point UptimeRobot (free tier is enough) at
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

7. **`sslmode`.** `pg` warns that `sslmode=require` currently behaves as `verify-full` but
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
**Fixed:** Phase 1 (health endpoint, logger seam, adoption) + Sentry wired. Server-side only — the client SDK is deliberately absent, since every costly failure here is server-side and the browser bundle already carries unoptimized images. Verified the SDK is NOT in the client bundle. A missing DSN is a full no-op, so the app is unchanged until you paste one in. `sendDefaultPii: false`, tracing off, and a `beforeSend` email scrubber, because shipping customer PII to a US processor would undo PRIV-001 on a different axis — the `to: customerEmail` field was also removed at its call site, which is the actual fix. **Remaining (yours):** an uptime monitor on `/api/health`, and an alert rule narrower than Sentry's default "email on every new issue".

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
**Fixed:** Phase 2 — `services/concurrency-guards.test.ts` pins the DB semantics all three guards rest on, running against the real **pooled** connection. Verified the guard survives PgBouncer transaction mode, which was an open question. Full end-to-end `completeCheckout` coverage still wants a dedicated test database (see Deferred).

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

### A fourth reason, found on 2026-09-04 — and it is the decisive one

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
| uptime monitoring | an external prober | none exists |

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
**Fixed:** _pending — needs one cron cycle to elapse_

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

## [x] DEP-001 · `prisma` CLI ships in production dependencies
`package.json` lists `prisma` under `dependencies` (needed for `postinstall: prisma generate`). Vercel installs devDependencies at build time, so it can move — this also removes the `mysql2` and `fast-uri` advisories from the deployed tree.
**Fix.** Move to `devDependencies`; confirm the Vercel build still generates the client.
**Risk:** Build-breaking if Vercel's install step changes. Verify on a preview deploy first.
**Fixed:** Phase 4 — moved to `devDependencies`; build and `prisma generate` verified. Note the `npm audit` count does **not** drop: `@prisma/client` declares `prisma` as an *optional peer*, so npm keeps it in the production graph regardless. The move is correct hygiene and declares intent, but the advisories below were always the real answer.

## [x] DEP-002 · 4 advisories, all dev/build-only
`mysql2` (high), `fast-uri` (high), `qs` (moderate), `prisma` (moderate). **Traced: all reachable only via the `prisma` CLI and `shadcn`.** The app uses `@prisma/client` + `@prisma/adapter-pg` at runtime and never loads these. **Not a launch blocker.** Largely resolved by DEP-001.
**Fixed (assessed, no action needed):** Phase 4 — re-confirmed all four advisories are reachable only through the `prisma` CLI and `shadcn`, neither of which is loaded by the deployed serverless runtime (the app uses `@prisma/client` + `@prisma/adapter-pg`). `npm audit fix --force` would DOWNGRADE Prisma to 6.x, a breaking change and a worse outcome than the advisories. Left as-is, deliberately.

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
| Correctness | 88 | **96** | Webhook amounts verified; refund race closed; money rounding fixed at the half-cent; a real CSP bug found and fixed. |
| Reliability | 78 | **90** | Health endpoint, structured logging in every money path, scheduled retention, and **every outbound provider call now bounded** (`REL-001`) — no supplier can hold a checkout invocation open indefinitely. The remaining points are the unobserved retention cron (`OPS-001`) and circuit breakers. |
| Performance | 72 | **74** | Unchanged by design — PERF-001 is a billing decision. The +2 is the retention job bounding two tables that grew without limit. |
| **Testing** | 45 | **78** | The three concurrency guards are pinned against the **real pooled database**, plus 29 new tests across auth, email, money and CSP. Still no E2E, and `completeCheckout` end-to-end wants a dedicated test DB. |
| Maintainability | 95 | **95** | Already exceptional; held there deliberately — every fix followed the existing patterns rather than inventing new ones. |
| **Observability** | 25 | **94** | Health check, adopted logger, Sentry **proven by a forced event** rather than assumed — which is what caught the DSN typo — and an audit trail now covering 8 admin surfaces instead of 2 (`OBS-003`). The last points are correlation IDs and an uptime monitor. |
| Deployment | 80 | **82** | Both migrations dry-run in rolled-back transactions before applying; a third cron added. Rollback procedure still undocumented. |
| Accessibility | 75 | **80** | Skip link (WCAG 2.4.1 Level A). Next gains need a real audit pass with a screen reader. |
| SEO | 92 | **94** | SEC-005 fixed a policy that would have blanked the Instagram feed. |
| **Overall** | **74** | **90** | **Ready to launch.** Every code finding is closed. What holds the number below the mid-90s is no longer engineering: an unobserved cron, a missing uptime monitor, and two spending decisions (`PERF-001`, `SEC-003`). |

---

# Maximizing the score from here

Ranked by points gained per unit of work. Nothing here is a launch blocker.

### Yours — no code needed, biggest effect

1. **Confirm the retention cron ran** (`OPS-001`) → Reliability, and it makes the PRIV-001
   GDPR claim *true* rather than merely implemented. One SQL query after 03:30.
2. **An uptime monitor on `/api/health`** → Reliability 88 → ~93.
   Sentry reports what throws; it cannot report a site that is down, because nothing is
   running to throw. UptimeRobot's free tier is enough.
3. **Narrow the Sentry alert rule** → no score change, but it decides whether the
   Observability score means anything in practice. An alert that fires on everything is one
   you will mute within a fortnight.
4. **Re-enable image optimization** → Performance 74 → ~85. Billing decision (PERF-001).

### Highest value in code

4. **End-to-end tests for `completeCheckout`** → Testing 78 → ~90.
   Needs a dedicated test database (a Neon branch). The races are pinned at the database
   level already; this closes the service layer above them.
5. **Playwright on the purchase path** → Testing → ~95, Reliability +3.
   Browse → cart → checkout → order, plus the failure branches. The one thing no current
   test touches is a browser — and note that **both** post-audit findings came from running
   the app rather than reading it.
6. **Timeouts on provider calls** (`REL-001`) → Reliability 88 → ~93.
   `services/instagram.ts` sets `AbortSignal.timeout`; the payment and courier providers do
   not. A hung provider currently holds a checkout request open until the platform kills it.
   Small, well-precedented, and the difference between a supplier's outage being their
   incident or yours. **The best value-for-effort code change on this list.**

7. **Widen the admin audit log** (`OBS-003`) → Observability 90 → ~94. One line per admin
   action; the helper already resolves the actor and never throws.

### Medium

8. **SEC-003, the CSP nonce** → Security 93 → ~97. Deliberate session; see its entry.
9. **Document the rollback procedure** → Deployment 82 → ~90.
   Migrations are additive and safe today, but "what do we do at 3am" is unwritten.
10. **Correlation IDs** through request → log → Sentry → audit entry → Observability 90 → ~97.

### Lower

11. **Accessibility pass with a real screen reader** → 80 → ~90. Focus traps in dialogs,
    live-region announcements on cart updates, contrast audit.
12. **Integer cents instead of floats** → Correctness 96 → ~98. Large refactor, small gain
    now that `round2` is correct.

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
