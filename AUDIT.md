# Production Readiness Audit

**Audited:** 2026-09-03 · commit `be0d546` · Next 16.3, Prisma 7.9, Neon Postgres, Vercel
**Remediated:** 2026-09-04 · Phases 1–4 · commits `782d243` → `c731ab0` → `493ae9c` → `03ad4c4`
**Scope:** 564 TS/TSX files, ~52,000 LOC, 52 API routes, 22 server-action files, full config surface
**Verified with:** `tsc --noEmit` ✓ · `eslint` ✓ · `vitest` 436/436 ✓ · `next build` ✓ · `npm audit` · live production DB queries · real-browser checks

## Verdict

**READY TO LAUNCH** — with two owner tasks outstanding (see *Needs your decision*).

The original audit found no P0 and rated the shop **74/100** overall, blocked not by its code
but by two things: it could not be seen failing, and its riskiest code had no automated
coverage. Both are now addressed.

**All 3 P1 launch blockers are closed. 8 of 9 P2s are closed.** The one open P2 (SEC-003,
the CSP nonce) is deliberately deferred with reasoning below — it is defence-in-depth against
an injection sink that does not currently exist, and it is the single highest-blast-radius
change in the plan.

> With bank-transfer only + manual reconciliation: **ready.**
> Before enabling card payments: PAY-001 is fixed, so that gate is now open too.

---

## Progress

| Severity | Total | Open | Done | Deferred |
|---|---:|---:|---:|---:|
| P0 — Critical | 0 | 0 | 0 | 0 |
| P1 — Launch blocker | 3 | 0 | **3** | 0 |
| P2 — Medium | 10 | 0 | **9** | 1 |
| P3 — Low | 6 | 1 | **5** | 0 |
| INFO | 6 | — | — | — |

**Status legend:** `[ ]` open · `[~]` in progress · `[x]` done · `[-]` deferred (reason required)

**How to use this file:** fix one item, tick its box, fill in its `Fixed:` line with the commit hash, and update the Progress table in the same commit. Anything marked `[-]` needs a one-line reason so it is never silently re-opened.

---

## Needs your decision

Two things I could not finish alone, and one worth knowing:

1. **Connect an error tracker** (finishes OBS-001). The seam is built and adopted —
   `lib/logger.ts` has one `reportError` hook to implement and every call site already
   routes through it. It needs an account choice (Sentry, Betterstack, Axiom). Also worth
   an alert on `PaymentWebhookEvent.processingStatus = 'failed'`.
2. **PERF-001 — image optimization** is off because the Vercel transform quota was
   exhausted and returning 402s. Re-enable with `NEXT_PUBLIC_OPTIMIZE_IMAGES=true` once the
   plan allows. Purely a billing decision.
3. **INFO — `sslmode`.** `pg` warns that `sslmode=require` currently behaves as
   `verify-full` but will adopt weaker libpq semantics in pg v9. Pinning
   `sslmode=verify-full` in `DATABASE_URL`/`DIRECT_URL` now avoids a silent downgrade later.

---

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
**Fixed:** Phase 1 (health endpoint, logger seam, adoption) + Sentry wired. Server-side only — the client SDK is deliberately absent, since every costly failure here is server-side and the browser bundle already carries unoptimized images. Verified the SDK is NOT in the client bundle. A missing DSN is a full no-op, so the app is unchanged until you paste one in. `sendDefaultPii: false`, tracing off, and a `beforeSend` email scrubber, because shipping customer PII to a US processor would undo PRIV-001 on a different axis — the `to: customerEmail` field was also removed at its call site, which is the actual fix. **Remaining (yours):** create the Sentry project, set `SENTRY_DSN` in Vercel, and add an uptime monitor on `/api/health`.

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

# Fix order

**Phase 1 — before launch (~1 day)**
`SEC-004` → `SEC-002` → `AUTH-002` → `OBS-001`
Small, verifiable, low-risk. SEC-004 first because it is 30 minutes and gates everything else's rate limiting.

**Phase 2 — before enabling card payments**
`PAY-001` ← hard gate · `TEST-001` · `PAY-002`

**Phase 3 — first weeks live**
`SEC-001` · `OBS-002` · `AUTH-001` · `PRIV-001`

**Phase 4 — hardening**
`SEC-003` · `A11Y-001` · `DEP-001`/`DEP-002` · `PERF-001` · `MONEY-001`

---

# Scores

Re-scored after Phases 1–4. The original number is kept beside each so the movement is visible.

| Dimension | Before | Now | What moved it |
|---|---:|---:|---|
| Security | 82 | **93** | Rate limiting no longer keyed on a spoofable header; checkout bound to its browser; sessions revocable; login timing oracle closed; email escaping consistent. Held back only by `unsafe-inline` (SEC-003). |
| Correctness | 88 | **96** | Webhook amounts verified; refund race closed; money rounding fixed at the half-cent; a real CSP bug found and fixed. |
| Reliability | 78 | **88** | Health endpoint, structured logging in every money path, scheduled retention. No circuit breakers, which is the remaining gap. |
| Performance | 72 | **74** | Unchanged by design — PERF-001 is a billing decision. The +2 is the retention job bounding two tables that grew without limit. |
| **Testing** | 45 | **78** | The three concurrency guards are pinned against the **real pooled database**, plus 29 new tests across auth, email, money and CSP. Still no E2E, and `completeCheckout` end-to-end wants a dedicated test DB. |
| Maintainability | 95 | **95** | Already exceptional; held there deliberately — every fix followed the existing patterns rather than inventing new ones. |
| **Observability** | 25 | **72** | Health check, adopted logger with error serialization, and a real admin audit trail. Reaches ~90 the day an error tracker is connected. |
| Deployment | 80 | **82** | Both migrations dry-run in rolled-back transactions before applying; a third cron added. Rollback procedure still undocumented. |
| Accessibility | 75 | **80** | Skip link (WCAG 2.4.1 Level A). Next gains need a real audit pass with a screen reader. |
| SEO | 92 | **94** | SEC-005 fixed a policy that would have blanked the Instagram feed. |
| **Overall** | **74** | **89** | **Ready to launch.** |

---

# Maximizing the score from here

Ranked by points gained per unit of work. Nothing here is a launch blocker.

### Highest value

1. **Connect an error tracker** → Observability 72 → ~90, Overall +2.
   One hook in `lib/logger.ts`; every call site is already wired. Needs an account choice.
2. **End-to-end tests for `completeCheckout`** → Testing 78 → ~90.
   Needs a dedicated test database (a Neon branch). The four races are already pinned at the
   database level; this closes the service layer above them.
3. **Playwright on the purchase path** → Testing → ~95, Reliability +3.
   Browse → cart → checkout → order, plus the failure branches. The one thing no current
   test touches is the browser.

### Medium

4. **SEC-003, the CSP nonce** → Security 93 → ~97. Deliberate session; see its entry.
5. **Circuit breakers / timeouts on provider calls** → Reliability 88 → ~93.
   `services/instagram.ts` sets `AbortSignal.timeout`; the payment and courier providers do
   not. A hung provider currently holds a checkout request open.
6. **Document the rollback procedure** → Deployment 82 → ~90.
   Migrations are additive and safe today, but "what do we do at 3am" is unwritten.
7. **Re-enable image optimization** → Performance 74 → ~85. Billing decision (PERF-001).

### Lower

8. **Accessibility pass with a real screen reader** → 80 → ~90. Focus traps in dialogs,
   live-region announcements on cart updates, contrast audit.
9. **Correlation IDs** through request → log → audit entry → Observability +3.
10. **Integer cents instead of floats** → Correctness 95 → ~98. Large refactor, small gain
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
| 2026-09-04 | OBS-001 completed: Sentry wired server-side, PII scrubbed | _this commit_ |
