# Session Summary — 2026-08-18 (full pre-launch audit, then 40 of 63 findings fixed)

Quick-reference recap of the LATEST session only — this file gets replaced each session, it's the fast catch-up, not the archive. See `PROGRESS.md` for the detailed batch-by-batch build log.

## Where things stand right now

A complete page-by-page, feature-by-feature pre-launch audit was run against the live Neon
database, then most of what it found was fixed. **18 commits, all pushed to `origin/main`,
HEAD is `ebcd82b`.** Working tree clean, `next build` / `tsc` / `eslint` / **186 tests** all green.

**63 findings. 40 fixed and verified, 1 partly fixed, 1 withdrawn, 21 open, 4 launch blockers.**

Two live audit documents (Claude artifacts, private until shared):
- **Current — Launch Readiness:** https://claude.ai/code/artifact/0795b30b-6cca-4921-a074-cefb8ff50ff4
- Original full audit (historical, 63 findings in detail): https://claude.ai/code/artifact/bd90ab98-6680-4c70-9d1b-7a0f7d532160

### The 4 remaining blockers — none of them is code

| | Needs |
|---|---|
| **QA-002** No card payment. `/api/payment-methods` returns only `cash-on-delivery`; both payment config tables are empty. Stripe is code-complete and unit-tested. | Stripe keys |
| **QA-003** No email is sent by anything. `EMAIL_PROVIDER` unset → dev provider logs to `EmailLog` and sends nothing. | Resend key + `EMAIL_FROM` |
| **QA-006** Canonical URLs, `robots.txt` and all ~190 sitemap entries still say `alexandris-demo.example`. | The real domain, set in **both** `NEXT_PUBLIC_SITE_URL` and the SEO `siteUrl` SiteContent row |
| **QA-024** The four footer social links are seeded handles, very likely other people's profiles. | Four real URLs |

Plus **the ΓΕΜΗ registry number** — legally required on a Greek commercial site. The user supplied
the ΓΕΜΗ-registered *name* but not the number. `COMPANY.gemiNumber` is `null`,
`traderIdentityLine()` omits the label rather than printing an empty one, and
`scripts/check-launch-placeholders.ts` fails while it stays null.

Run `npx tsx scripts/check-launch-placeholders.ts` before any deploy — it currently reports
exactly those two gaps (ΓΕΜΗ number, demo domain in `seo.json`) and nothing else.

## Real business details are now in the app

`constants/company.ts` is the single source of truth, feeding the footer, contact page, all three
legal documents and the Organization JSON-LD:

- Legal name (as in ΓΕΜΗ): **Alexandris Michail** — deliberately a separate field from
  `brandName` (`ALEXANDRIS`). Legal documents must name the registered trader; using the
  shopfront name defeats the point of naming the data controller.
- Address: Arthur Evans 9, 71201 Heraklion, Crete, Greece
- ΑΦΜ: 146214557 · email: alexandrisstores@gmail.com · phone: 2814 001 031

## The big fixes, and why they mattered

- **VAT was being ADDED to prices that already included it** at a non-Greek 21% — a €59 shoe
  billed at €78.34, contradicting the shop's own Terms. Now inclusive at the Greek 24%:
  `vatIncludedIn()` is `gross × rate / (1 + rate)`, NOT `gross × rate`. Confusing those two is the
  original bug, so it's one named function. VAT is computed on the pre-gift-card total — a gift
  card is a means of payment, not a price reduction.
- **Storefront search moved into Postgres** (`services/search.ts` + `/api/search`). `/women` went
  from **205,636 bytes to 13,278** (94%) and from two full-catalog requests to one. Raw SQL, not
  the query builder, because every price rule uses the EFFECTIVE price
  `COALESCE(salePrice, price)` which Prisma can't express in `where`/`orderBy` — and 172 of 175
  products carry a sale price. Facets count the SCOPE not the refined set (otherwise picking
  "black" zeroes every other colour), and every sort carries `p.id` as a tiebreaker (without a
  total order, equal-priced products swap between pages and one is never seen).
- **Soft 404s**: the root `app/loading.tsx` wrapped every route in a Suspense boundary that
  committed HTTP 200 before `notFound()` could run, so every missing product/category/collection/
  journal/legal page returned 200. Now scoped to an `app/(listing)/` route group covering only
  pages that can't 404. **Adding a `loading.tsx` to any route that calls `notFound()` reintroduces this.**
- **Password reset was entirely dead** — `proxy.ts` gated `/account/reset-password` behind a
  session, so the emailed link bounced to login. It's now reachable in BOTH states.
- **Fabricated content removed**: "N people bought this in the last 48 hours" was a hash of the
  SKU (a zero-sales product showed "27 people"). Deleted, not flagged off.
- **Admin edits silently destroyed page titles**: RHF submits `seo: {title:"",description:""}` and
  `??` doesn't fall back on `""`. Fixed at both ends. **The first attempt silently did nothing** —
  `undefined` is Prisma's "leave this column alone"; nullable JSON needs `Prisma.DbNull`.
- **Stock never came back on cancel/refund.** Now claimed via a null-guarded `Order.restockedAt`
  so a re-save can't double-credit. **Returns still don't restock (QA-063)** — separate path,
  needs its own per-item claim column.
- **Admin user management** now exists (create/delete/self-password-change). Previously the only
  way to add an admin was a direct DB write. **There is still only ONE admin account** — the page
  warns about it in place; create a second.

## Merchandising decisions worth not undoing

- Collections were filled from each product's category (`scripts/merchandise.ts`, re-runnable):
  Sneaker Edit 33, Evening Heels 30, Boots & Booties 17, Everyday Essentials 82, New Arrivals 24.
- **"Best Sellers" is deliberately left OFF.** There are 2 real payments; any list under that
  heading would be a claim about sales that never happened — the same class of thing as the fake
  purchase counter that was just removed. Turn it on when there's order history.
- The homepage's `collectionIds` `c1`–`c5` were **never stale** — they are the real IDs. The
  original audit was wrong about that; the section only looked broken because the collections were empty.
- `/new-in` no longer filters on `isNew` (no product has ever had it) — it sorts by `createdAt`.
  That also fixed the "Newest" sort being a **no-op on every listing page**.
- **Stock levels (~1 pair per size) are REAL and correct** — an audit finding claiming otherwise
  was withdrawn. What was wrong was the badge: it counted total units, so it fired on 147 of 164
  products. It now counts available SIZES and says "Last size" / "Few sizes left".
- Six seeded test orders were purged; dashboard revenue went €1,196.43 → **€146.52** (2 real orders).

## Traps that cost real time this session — don't repeat them

- **`pkill -f "next start"` does NOT kill the process here.** Every rebuilt server after the first
  failed to bind with `EADDRINUSE` and silently kept serving the OLD build, which made
  byte-identical code appear to behave differently at two paths. Kill by port
  (`netstat -ano | grep :PORT` → `taskkill //PID <pid> //F`) and **check the server log for
  `EADDRINUSE` before trusting any result.**
- **Folders named `__something` are PRIVATE in the App Router** and are never routed. Probe routes
  named `__probe*` returned 404 because the route didn't exist, not because `notFound()` worked.
- **Restart the dev server after a Prisma schema change.** The running server holds a stale client;
  the first restock test silently did nothing because of it.
- **Tightening an input schema can break reading existing rows.** Making `phone` required broke the
  admin dashboard with a 500, because `addressSchema` doubled as the parser for stored JSON in
  `toOrder`/`toCheckout`. Split into strict `addressSchema` (input) and lenient
  `storedAddressSchema` (persisted data). `tsc`, `eslint` and all tests stayed green throughout —
  none of them touch stored rows. **Historical records are facts, not submissions.**
- **Deleting an order does NOT restock it.** Five units silently went missing from the live catalog
  during testing before this was noticed. Restore stock as part of cleanup.
- Bash heredocs/`node -e` mangle UTF-8 Greek and eat backticks — drive UTF-8 payloads from the
  browser (`javascript_tool`) or write files with the Write tool instead.
- Files in this repo are **mixed LF and CRLF** — detect the line ending before doing anchored
  string replacements in scripts.

## Useful scripts added this session

| Script | Purpose |
|---|---|
| `scripts/check-launch-placeholders.ts` | **Run before every deploy.** Fails on demo domain / missing ΓΕΜΗ. |
| `scripts/merchandise.ts` | Re-runnable: fills collections from categories, enables homepage sections. `--dry-run` supported. |
| `scripts/purge-test-orders.ts` | Explicit id allow-list, `--dry-run` first. Never pattern-match orders for deletion. |
| `scripts/rewrite-legal.ts` | Regenerates `data/legal.json` from `constants/company.ts`. Re-run after setting the ΓΕΜΗ number. |
| `scripts/apply-company-details.ts` | Writes contact details into the live `SiteContent` row (the JSON is only a fallback). |

## What's open below blocker level

QA-017 (create a 2nd admin — the UI now exists), QA-018 (Greek covers ~88 UI strings only; no
`hreflang`, no locale URLs, so only one language is indexable), QA-028 (OG image is Unsplash
stock), QA-029 (no analytics connected; consent gate exists but nothing calls it), QA-030
(`npm audit`: 3 high via `prisma → @prisma/config → deepmerge-ts`, build-time reach, no clean
upgrade), QA-046 (**partly fixed** — orders and inventory are server-paged and searchable;
`/admin/products` 175 and `/admin/media` 317 still render everything client-side, because their
filter/sort/bulk-selection state is interdependent and paging them means first deciding what
select-all means across pages), QA-063 (returns don't restock), plus the medium/low tail.

Deliberately NOT changed: `/admin/appearance` (read-only, honest, documents design tokens) and
`browserslist` (decides which browsers can shop here — a business call).
