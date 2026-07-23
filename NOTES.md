# Session Summary — 2026-07-23 ("complete, upload-ready eshop" push, payment excluded)

Quick-reference recap of the LATEST work. See `PROGRESS.md` for the detailed per-batch log; this file gets replaced each session — it's the fast catch-up, not the archive.

## What this session did

User asked for a complete, ready-to-use eshop — everything except Stripe/payment — plus a set of "flagship" differentiators, plus English+Greek. Planned via `EnterPlanMode` as 3 batches, all now **done and verified** (tsc/eslint/build clean + live browser walkthroughs for every feature, every batch).

## Batch 1 (production essentials)
Real email (Resend), rate-limit gaps closed, real returns flow (was a total facade), order tracking + a real ACS Courier API adapter (untested against a live account on purpose — needs the user's real credentials + go-ahead), cookie consent banner, a Contact form that actually sends, and — the user's own mid-session complaint, confirmed real — **the admin dashboard's Homepage Sections/Navigation/SEO/Settings editors were ALL fake local state that discarded on reload**, now genuinely Postgres-backed via a new `SiteContent` key/Json table, plus a real admin order detail page and real Blog CRUD.

## Batch 2 (flagship differentiators)
Loyalty tiers, gift wrapping (touched `CartTotals` everywhere — real backward-compat bug the build itself caught, see `PROGRESS.md`), wishlist sharing, PDP fit/size recommendation, a real experimentation platform (live A/B test on the homepage hero CTA), an "Ask a Stylist" concierge flow, and a referral program (real minted gift-card reward on a referred customer's first order).

## Batch 3 (English + Greek)
Real `next-intl` infra, **cookie-based locale, no `/en/`/`/el/` URL prefix** (a deliberate scope-down from the original plan, agreed with the user mid-batch — see `PROGRESS.md` for the trade-off). Real translation: full UI chrome (header/nav/search/cart/checkout/PLP/PDP/account), plus real Greek product names/descriptions and collection titles (new `nameEl`/`descriptionEl`/`titleEl`/etc. columns, all 12 products + 5 collections translated for real). **Important cost discovered via the build, not anticipated going in**: because locale is resolved from a cookie in the root layout, the entire site lost static generation (every route went from `○`/`●` to `ƒ` in the build output) — a genuine perf/cost trade-off worth revisiting later, documented in `PROGRESS.md`.

## Notes for next time

- **`prisma migrate dev` cannot run at all in this shell** — always errors "environment is non-interactive" even with `--create-only`. Every migration this session was hand-authored (`migration.sql`, matching Prisma's exact generated style) and applied via `prisma migrate deploy`. That command also hit a Neon advisory-lock timeout a couple of times while the dev server had an open connection — **stop the dev server before running migrations**, worked every time.
- **The barrel/client-bundle landmine (documented since Real Backend Phase 1) bit again in Batch 1**: making `services/homepage.ts`/`navigation.ts`/`settings.ts`/`blog.ts` Prisma-backed broke the client bundle because `lib/commerce/providers/mock/cms.service.ts` (browser-side) imported them directly. Fixed with new `/api/cms/*` Route Handlers + `fetchJson`. **If any currently-JSON-backed `services/*.ts` file ever becomes Prisma-backed, grep for who imports it before assuming it's safe.**
- Seeding/one-off scripts: `scripts/seed.ts` runs fine via `next build`'s own tooling but hits a separate gap when run directly via `tsx` — `lib/auth.ts`'s `server-only` guard throws (no `react-server` condition outside Next's build). Every one-off script this session (CMS content seed, nav patch, Greek translations) was a throwaway file that avoided importing `lib/auth.ts`, then deleted after running.
- ACS Courier (`lib/courier/providers/acs.ts`) and Resend email are real code, never exercised against live accounts — both need the user's real credentials in `.env` (see `.env.example`) before they do anything beyond the safe `manual`/`dev` defaults.
- i18n coverage is real but intentionally bounded — see `PROGRESS.md`'s Batch 3 entry for exactly what's translated vs. what's a known, disclosed gap (PLP product names, homepage marketing copy, long-form content pages).
