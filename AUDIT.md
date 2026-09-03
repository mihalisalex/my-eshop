# Production Readiness Audit

**Audited:** 2026-09-03 · commit `be0d546` · Next 16.3, Prisma 7.9, Neon Postgres, Vercel
**Scope:** 564 TS/TSX files, ~52,000 LOC, 52 API routes, 22 server-action files, full config surface
**Verified with:** `tsc --noEmit` ✓ · `eslint` ✓ · `vitest` 407/407 ✓ · `next build` ✓ · `npm audit` · live production DB queries

## Verdict

**READY AFTER REQUIRED FIXES** — no P0 found.

No authentication bypass, no SQL injection, no XSS sink, no RCE, no committed secret, no unauthorized bulk-PII path, no currently-exploitable payment-integrity flaw. All were actively hunted for.

What blocks launch is not the code. It is that **you cannot see it fail** (no error tracking, alerting, health check or audit log) and that the **highest-risk code has no automated coverage** — 407 tests exist but almost none touch the stateful commerce core.

> With bank-transfer only + manual reconciliation: safe to launch after Phase 1.
> With card payments enabled: **PAY-001 is a hard gate.**

---

## Progress

| Severity | Total | Open | Done |
|---|---:|---:|---:|
| P0 — Critical | 0 | 0 | 0 |
| P1 — Launch blocker | 3 | 2 | 1 |
| P2 — Medium | 9 | 6 | 3 |
| P3 — Low | 6 | 5 | 1 |
| INFO | 5 | — | — |

**Status legend:** `[ ]` open · `[~]` in progress · `[x]` done · `[-]` won't fix (reason required)

**How to use this file:** fix one item, tick its box, fill in its `Fixed:` line with the commit hash, and update the Progress table in the same commit. Anything marked `[-]` needs a one-line reason so it is never silently re-opened.

---

# P1 — Launch Blockers

## [~] OBS-001 · Observability — the system cannot be seen failing

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
**Fixed:** health endpoint + logger seam + adoption — Phase 1. **Remaining:** connect an error tracker (needs your account choice) and an alert on `PaymentWebhookEvent.processingStatus = 'failed'`.

---

## [ ] TEST-001 · The stateful commerce core has zero tests

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
**Fixed:** _pending_

---

## [ ] PAY-001 · Webhook does not verify amount or currency ← hard gate for card payments

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
**Fixed:** _pending_

---

# P2 — Medium

## [ ] SEC-001 · Unauthenticated checkout PATCH returns full PII and permits address overwrite

**Location:** `app/api/checkout/[checkoutId]/route.ts`
**Confidence:** Confirmed

Holding a `checkoutId` lets anyone PATCH a trivial field (`{"giftWrap": false}`) and receive the **entire checkout** — email, phone, shipping and billing address — and **overwrite the delivery address** before the order is placed.

**Mitigating (verified, not assumed):** ids are unguessable cuids, held in `localStorage`/memory, **never in a page URL** (`/checkout`, not `/checkout/[id]`), so they do not leak via `Referer` or browser history. Rate-limited 60/10min. Not enumerable.

**Fix.** Bind the checkout to a signed httpOnly cookie at creation — the grant pattern already implemented in `lib/order-access-cookie.ts` — and narrow the response to the fields the client renders.

**Verify.** PATCH with a valid id but no cookie → 403. Existing checkout flow still completes end to end.

**Risk of change:** Medium — touches the live checkout flow. Test the full purchase path after.
**Fixed:** _pending_

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

## [ ] SEC-003 · CSP allows `'unsafe-inline'` for scripts in production

**Location:** `next.config.ts` — `CONTENT_SECURITY_POLICY`
**Confidence:** Confirmed · already documented in-file (QA-057)

Dev-only `unsafe-eval` was correctly removed, but `unsafe-inline` remains in both environments, which negates most of the CSP's XSS value. No injection sink currently exists, so this is defence-in-depth rather than an active hole.

**Fix.** Per-request nonce generated in `proxy.ts`, threaded through Next's inline bootstrap, the consent script and Framer Motion's inline styles.

**Risk of change:** Medium — a missed inline script breaks the page. Do this deliberately, not casually.
**Fixed:** _pending_

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

## [ ] PAY-002 · Refund read-check-write race

**Location:** `services/payments.ts:705-730` — `refundPayment`
**Confidence:** Confirmed (theoretical race; narrow window)

Reads `refundedAmount`, checks `remaining`, calls the provider, then applies. Two concurrent refunds can both pass the check. This is inconsistent with the conditional-`UPDATE` rigor applied to stock and gift cards in `completeCheckout`.

Narrow (admin-only, requires a double-submit) and the provider may reject the duplicate — but it moves money.

**Fix.** Guard with a conditional update, matching the existing pattern:
`updateMany({ where: { id, refundedAmount: { lte: amount.amount - requested } }, … })` and treat `count === 0` as a conflict.

**Verify.** Two simultaneous refund calls for the full amount → exactly one succeeds.
**Fixed:** _pending_

---

## [ ] PRIV-001 · Webhook payloads retained indefinitely (GDPR)

**Location:** `prisma/schema.prisma` — `PaymentWebhookEvent.rawPayload`
**Confidence:** Confirmed

Verbatim webhook bodies (100KB cap) are stored forever. For card providers these contain names, emails, addresses and card metadata. The shop operates in Greece — GDPR applies, and indefinite retention of payment PII has no lawful basis once forensic need has passed.

**Fix.** Retention job purging `rawPayload` (or the row) older than 90 days. A Vercel cron already exists as a pattern in `vercel.json`.

**Verify.** Seed a row dated 100 days ago; confirm the job clears it and leaves a 10-day-old row intact.
**Fixed:** _pending_

---

## [ ] OBS-002 · No admin audit log

**Location:** repo-wide · `constants/permissions.ts` documents the removal of `admin:activity`
**Confidence:** Confirmed

Refunds, customer-PII access, role changes and order edits are **not recorded anywhere**. The permissions file itself notes `admin:activity` was removed "with the seeded activity log it gated… It comes back with the real AdminAuditLog." That log was never built.

For a system where staff issue refunds and read customer addresses, this is both an operational blind spot and a compliance gap.

**Fix.** `AdminAuditLog` table: actor, action, target type/id, before/after summary, timestamp, IP. Write from `requireCapability`-guarded mutations, starting with refunds, role changes and order edits.

**Verify.** Issue a refund; confirm a row with the correct actor id.
**Fixed:** _pending_

---

## [ ] AUTH-001 · Password reset does not invalidate existing sessions

**Location:** `lib/password-reset.ts` · `lib/customer-auth.ts` (7-day JWT) · `lib/auth.ts` (1-day JWT)
**Confidence:** Confirmed

Sessions are stateless JWTs. After a compromise-driven password reset, the attacker's existing session remains valid until natural expiry — up to 7 days for a customer.

**Fix.** Add `sessionsValidFrom: DateTime` to `Customer`/`AdminUser`; set it on password change/reset; reject tokens issued before it in the session DAL (`lib/customer-session.ts`, `lib/admin-session.ts` — both already do a DB read per request, so this is nearly free).

**Verify.** Sign in on two browsers, reset the password in one, confirm the other is signed out on next request.
**Fixed:** _pending_

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

# P3 — Low

## [ ] A11Y-001 · No skip-to-content link
WCAG 2.4.1 (Bypass Blocks), Level A. Keyboard users must tab through the full header on every page. ARIA is otherwise good — 99 `aria-invalid`, 91 `aria-label`, 26 `aria-describedby`, `aria-modal` on dialogs.
**Fix.** Visually-hidden anchor to `#main` as the first focusable element in `app/layout.tsx`.
**Fixed:** _pending_

## [ ] DEP-001 · `prisma` CLI ships in production dependencies
`package.json` lists `prisma` under `dependencies` (needed for `postinstall: prisma generate`). Vercel installs devDependencies at build time, so it can move — this also removes the `mysql2` and `fast-uri` advisories from the deployed tree.
**Fix.** Move to `devDependencies`; confirm the Vercel build still generates the client.
**Risk:** Build-breaking if Vercel's install step changes. Verify on a preview deploy first.
**Fixed:** _pending_

## [ ] DEP-002 · 4 advisories, all dev/build-only
`mysql2` (high), `fast-uri` (high), `qs` (moderate), `prisma` (moderate). **Traced: all reachable only via the `prisma` CLI and `shadcn`.** The app uses `@prisma/client` + `@prisma/adapter-pg` at runtime and never loads these. **Not a launch blocker.** Largely resolved by DEP-001.
**Fixed:** _pending_

## [ ] PERF-001 · Image optimization disabled globally
`next.config.ts` → `images.unoptimized: true`. Deliberate and documented — the Vercel transform quota was exhausted and returning 402s, breaking images across the shop. Real bandwidth/LCP cost (~100KB JPEGs served raw).
**Fix.** Re-enable via `NEXT_PUBLIC_OPTIMIZE_IMAGES=true` once the plan allows.
**Fixed:** _pending_

## [x] LOG-001 · `lib/logger.ts` adopted in only 2 files
Folded into OBS-001 — listed separately so the cleanup is not forgotten once error tracking lands.
**Fixed:** Phase 1 — adopted in checkout, orders and the webhook route; `logger.error` now serializes the error itself.

## [ ] MONEY-001 · `round2` half-cent edge
`Math.round(v * 100) / 100` yields `1.005 → 1.00`. Sub-cent, rare, and money is stored as `Decimal(10,2)` so it never compounds.
**Fix (optional).** Epsilon-corrected rounding, or move cart math to integer cents.
**Fixed:** _pending_

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

| Dimension | Score | Basis |
|---|---:|---|
| Security | 82 | No P0; strong fundamentals; loses points on `unsafe-inline`, SEC-001, XFF trust |
| Correctness | 88 | Races correctly solved; money handled properly |
| Reliability | 78 | Good failure reasoning in code; no health check or circuit breaking |
| Performance | 72 | Sound queries, N+1 explicitly fixed in checkout; unoptimized images |
| Testing | 45 | 407 tests but the stateful core is untested; no E2E |
| Maintainability | 95 | Exceptional — comments explain *why*, including rejected alternatives |
| Observability | 25 | Weakest dimension by far |
| Deployment | 80 | Correct pooling, crons, migrations; no documented rollback |
| Accessibility | 75 | Good ARIA; no skip link |
| SEO | 92 | Genuinely strong — canonicals, structured data, redirects, noindex |
| **Overall** | **74** | **Ready after required fixes** |

---

## Changelog

| Date | Change | Commit |
|---|---|---|
| 2026-09-03 | Initial audit against `be0d546` | `744d702` |
| 2026-09-03 | Phase 1: SEC-004, SEC-002, AUTH-002, LOG-001 fixed; OBS-001 partial | _this commit_ |
