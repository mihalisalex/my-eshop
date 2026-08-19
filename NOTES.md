# Session Summary — 2026-08-18 (go-live: the shop is now publicly launched)

Quick-reference recap of the LATEST session only — this file gets replaced each session, it's the fast catch-up, not the archive. See `PROGRESS.md` for the detailed batch-by-batch build log.

## Where things stand right now

**The shop is live and open for business at https://shopalexandris.vercel.app.** Two commits
this session, both pushed to `origin/main`, HEAD is `0229648`. Working tree clean,
`next build` / `tsc` / `eslint` / **186 tests** all green, and
`npx tsx scripts/check-launch-placeholders.ts` **passes for the first time**.

Of the 4 launch blockers carried in from the audit session, **all 4 are resolved** — two by
fixing them, two by an explicit decision to launch without them.

| Blocker | Outcome |
|---|---|
| **QA-006** demo domain in canonicals, robots.txt, ~190 sitemap entries | **Fixed.** Now `shopalexandris.vercel.app` everywhere. 207 sitemap URLs, zero demo references. |
| **QA-024** four seeded social links, likely strangers' profiles | **Fixed**, and it was worse than filed — see below. |
| **QA-002** no card payment | **Deferred by decision.** Launching cash-on-delivery only. |
| **QA-003** no email is sent | **Deferred by decision.** Resend key still to come. |

## What went live

### The domain, and why it takes three places

`alexandris-demo.example` is a reserved domain that does not exist. It was in canonical tags, in
`robots.txt` and in every sitemap entry. Three different things read the site URL and **all three
had to be set** — this is the trap:

- the live `SiteContent` **"seo" row** → canonicals, OG tags, robots.txt, sitemap
- **`data/seo.json`** → only the fallback used when that row is missing
- **`NEXT_PUBLIC_SITE_URL`** → links inside emails sent with no incoming request to derive a host from

**Editing the JSON alone changes nothing a visitor sees**, because the running shop reads the
database. That is exactly how the demo domain survived as long as it did.
`scripts/apply-site-url.ts` does the database half and is what you re-run the day a real domain
lands: `npx tsx scripts/apply-site-url.ts https://example.gr`.

`NEXT_PUBLIC_SITE_URL` is set on **Production only** on purpose. Setting it for Preview too would
make every preview deployment advertise the production URL.

### One handle, four copies, three of them wrong

The audit filed this as "four footer social links". It was bigger. The unverified `@alexandris`
identity sat in **four** places serving three audiences:

| Where | Audience |
|---|---|
| `settings.socialLinks` | the footer links, for people |
| `seo.organization.sameAs` | Organization JSON-LD, for search engines |
| `seo.twitterHandle` | the `twitter:creator` meta tag on **every page** |
| homepage `socialGrid.handle` | the "@…" under the homepage "Follow Along" heading |

`sameAs` and `twitter:creator` are the strong claims — they assert those accounts *are* this
business. None were ever verified as belonging to this trader, so the shop was pointing customers
at strangers and telling Google and X that the strangers were the shop. All four are now empty.

**The three derived copies are now computed, not maintained.** `scripts/apply-social-links.ts`
owns all four and derives the X handle from the `x` link and the homepage handle from the
`instagram` link. Four hand-kept copies of one fact is how three of them came to be wrong. To add
the real profiles: edit `data/settings.json`, run `npx tsx scripts/apply-social-links.ts`.

Handles are **deleted, not blanked** — `buildMetadata` passes `twitterHandle` straight to
`twitter.creator`, and an empty string still emits the tag, pointing at nobody rather than at a
stranger. `organizationSchema` omits `sameAs` entirely when empty, because a visible `[]` invites
someone to "fix" it by putting the seeded handles back.

### ΓΕΜΗ: recorded as a decision, not left as an absence

The trader states they are **not ΓΕΜΗ-registered**. That is now recorded rather than looking like
a missing value, because a null number means two different things and only one is safe to launch
on. `COMPANY.gemiRegistration` distinguishes:

- `"unknown"` — nobody has answered. **The launch check fails on this.**
- `"not-registered"` — a decision. Check passes, and **prints the decision on every run** so a
  provisional answer doesn't become permanent just by ceasing to fail.
- `"registered"` — requires `gemiNumber`; the check fails if the two disagree.

**This is worth re-confirming with an accountant.** A Greek trader selling at distance is normally
required to register, and the number must then appear on the site. On the day it exists: set
`gemiRegistration` to `"registered"`, fill `gemiNumber`, re-run `scripts/rewrite-legal.ts`.

## Production environment — two problems found, one still open

Neither was on the audit's list. Both were found by reading the actual Vercel production env.

- **`PAYMENT_CONFIG_SECRET` is misspelled.** The code reads **`PAYMENTS_CONFIG_SECRET`** (with the
  S). So credential encryption is unconfigured in production: the admin payments page shows its
  warning banner, and **saving any Stripe key there would fail**. Nothing breaks today — cash on
  delivery and bank transfer store no secrets. **STILL OPEN — the user is renaming it in the
  dashboard.**
- **`BLOB_READ_WRITE_TOKEN` was absent in production**, so Media Library uploads and CSV
  product-image imports would have failed on the live site. **Fixed** — copied from local `.env`
  to Production. Note it is **Production only**; preview deployments still have no Blob token.

Vercel env changes only take effect on the **next deployment**. Both new variables landed with the
`0229648` deploy.

## Deliberate decisions this session — don't undo these by "fixing" them

- **Cash on delivery is the only payment method**, and the footer correctly advertises exactly
  that. Bank transfer is real and complete but has **no config row**, so it never reaches checkout.
  Turning it on is only: bank name, account holder, IBAN in
  `/admin/settings/payments/bank-transfer`. No code needed.
- **No social profiles at all** beats four wrong ones. The footer's social `<ul>` is now not
  rendered when the list is empty — it collapsed to zero height but kept its `mt-6`, leaving 24px
  of dead space under the newsletter form.
- The homepage **"Follow Along" section is still enabled** — it is real lifestyle photography and
  stands on its own. It just no longer claims a handle, and its tiles aren't links until an
  Instagram URL exists.
- **Deployment protection**: Vercel SSO is on for `all_except_custom_domains`. Only
  `shopalexandris.vercel.app` is public; `my-eshop-alexandris.vercel.app` 302s to a Vercel login.
  Don't advertise the other aliases.

## Verified against the live deployment

- 207 sitemap URLs, **zero** references to the old demo domain; robots.txt points at the right host
- canonical tag correct; **no** `twitter:creator`; **no** `@alexandris` anywhere on the homepage
- Organization JSON-LD carries the real legal name, address, ΑΦΜ, email and phone, with **no**
  `sameAs`
- footer identity line renders correctly and omits the ΓΕΜΗ label rather than showing an empty one
- catalogue browses, product page selects sizes, **add-to-cart works**, cart totals correct:
  €34.90 + €6.95 shipping = €41.85 with €8.10 VAT, which is 24% **inclusive**
  (`41.85 × 0.24/1.24`), not added on top
- the footer's accepted-payment list resolves through the real availability pipeline and shows
  exactly **Cash on Delivery**

Checkout was **not** driven past the contact step — that means submitting forms on production, and
a completed order decrements stock which deleting it does not restore.

## The one admin account

Confirmed against the live database: **exactly one `AdminUser` row**, `alexandrisstores@gmail.com`,
and its password is **not** the seeded `admin123`. The demo account is gone. But one account is
still one lost password away from lockout — **create a second admin** at `/admin/users`.

**The published admin password is gone (fixed, `6ac548c`).** `README.md` had advertised
`admin@alexandris-demo.example` / `admin123` in a **public** repo — a working login to the account
that edits prices and reads customer addresses, had anyone ever seeded it against a real database.
Fixed at the root, not in the prose: `lib/auth.ts` no longer exports `DEMO_ADMIN_*`, and
`scripts/seed.ts` reads `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, generating a random password
and printing it **once** when unset.

Two guards on the seed, because seed scripts get run against production eventually: it **skips
entirely** when admins already exist and no `SEED_ADMIN_EMAIL` was given (otherwise re-seeding the
live database silently adds an `admin@example.com` with admin rights), and it **creates rather than
upserts**, so a re-run can never reset an existing admin's password or role.

## Six post-launch findings, all closed

QA-018, QA-029, QA-030, QA-041, QA-046 and QA-063 are done — 5 commits, `7170a96` → `6dcae75`.
213 tests (up from 186). Three of them turned out to be different problems than filed:

- **QA-063 (returns don't restock)** — the fix is small; the *interaction* is the point. A return
  covers a subset of an order's lines, so refunding the order after an item was returned would
  credit it twice, **inventing stock that never existed**. That is worse than the original bug —
  unsellable stock is visible the moment a customer tries to buy, phantom stock is only discovered
  when an order can't be fulfilled. `Return.restockedAt` is its own once-only claim; the return
  path skips if the order was already restocked, and the order path subtracts what returns already
  credited. That subtraction is a pure, tested function in `services/restock.ts`.
- **QA-041 (order id in the URL)** — `?order=<cuid>` was the credential for a page showing name,
  address, phone and purchase. Ids are unguessable, so this never leaked by brute force; it leaks
  by being **shared** — history, `Referer`, pasted into chat. The id now says *which* order; an
  httpOnly grant cookie (or customer ownership) says *whether*. **SameSite is Lax, not Strict, and
  that is load-bearing** — a payment provider returns the shopper by cross-site top-level
  navigation, and Strict withholds the cookie on exactly that request.
- **QA-018 (Greek localisation)** — filed as a bilingual site with thin Greek. **It is a Greek
  shop that was declaring `<html lang="en">`.** All 175 products store Greek in `name`; the
  `nameEl`/`descriptionEl` columns are empty on every one. Greek is now the default.
  **No locale URLs and no `hreflang`, on purpose** — both modes render identical content, so
  `/en/` and `/el/` would be ~95% duplicates, which costs rankings. Revisit when content is
  genuinely translated (see `i18n/request.ts`).
- **QA-029 (analytics)** — the consent gate existed but nothing called it, so the banner asked
  permission for something that never happened. GA4 now loads only after consent *and* only when
  `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set. **The CSP widens to permit Google's hosts only when
  that var is set** — a policy permitting what the app doesn't do is how a CSP stops being worth
  having.
- **QA-046 (admin paging)** — products and media now page in SQL. The blocker was never the query,
  it was select-all: the header checkbox means "this page", and "select all N matching" stores the
  **filter**, which the server re-derives. Shipping every id to the browser would have smuggled
  the unbounded payload back in.
- **QA-030 (`npm audit`)** — now clean, with prisma still on 7.9.1. `npm audit fix --force`
  "fixes" it by **downgrading prisma to 6.12.0**; an `overrides` entry lifts the transitive
  `deepmerge-ts` to 8.0.1 instead.

## Still open below blocker level

QA-017 (create a 2nd admin — UI exists), QA-028 (OG image is Unsplash stock), plus the medium/low
tail (QA-036, 038–040, 042–045, 047–049).

**Greek content still to write** — this is a content job, not code: page headings ("Women"), SEO
titles and descriptions, category and collection names, blog posts, and the legal pages are all
still English.

Deliberately NOT changed: `/admin/appearance` (read-only, honest) and `browserslist` (a business
call about which browsers can shop here).

## Traps that cost real time — still true, don't repeat them

- **Bash `grep -r` over this repo times out** (it walks `node_modules`). Use the ripgrep-backed
  Grep tool instead.
- **`pkill -f "next start"` does NOT kill the process here.** Kill by port
  (`netstat -ano | grep :PORT` → `taskkill //PID <pid> //F`) and **check the log for `EADDRINUSE`
  before trusting any result** — a rebuilt server that failed to bind keeps serving the OLD build.
- **`robots.txt` and `sitemap.xml` are statically prerendered.** They bake the database values at
  **build** time, so a DB change needs a redeploy. Canonicals are dynamic and update immediately —
  which is why the two disagreed mid-session and it was not a bug.
- **Folders named `__something` are PRIVATE in the App Router** and are never routed.
- **Restart the dev server after a Prisma schema change** — the running server holds a stale client.
- **Restart it after adding a `messages/*.json` namespace too.** Next caches the dynamic import,
  so new keys render as raw `PRODUCTBADGE.SALE` until restart. Looks exactly like broken wiring.
- **`server-only` modules cannot be imported by a `tsx` script.** Verifying a service from the
  command line means re-running its SQL directly, not importing it.
- **Ordering by an expression that is NULL for every row proves nothing.** The admin margin sort
  had to be checked against synthetic values, because every product has `costPriceAmount` NULL —
  real data exercised only the NULL branch and would have passed whatever the CASE said.
- **`undefined` is Prisma's "leave this column alone"**; clearing a nullable Json column needs
  `Prisma.DbNull`.
- **A `loading.tsx` on any route that calls `notFound()` reintroduces app-wide soft 404s.**
- **Tightening an input schema can break reading rows already written.** `tsc`, `eslint` and tests
  all stay green while it happens — none of them touch stored rows.
- **Deleting an order does NOT restock it.**
- **Emptying a JSON array changes its inferred type.** `socialLinks: []` infers as `never[]`, so
  `typeof settingsFallback` made putting a real link back a type error. Type these scripts from the
  declared interfaces, not from the JSON.
- Bash heredocs/`node -e` mangle UTF-8 Greek and eat backticks — use the Write tool for those files.
- Files here are **mixed LF and CRLF** — detect the line ending before anchored replacements.

## Scripts (all re-runnable, all print before/after)

| Script | Purpose |
|---|---|
| `scripts/check-launch-placeholders.ts` | **Run before every deploy.** Now passes. |
| `scripts/apply-site-url.ts` | **New.** Sets the canonical URL in the live seo row. Run when the real domain lands. |
| `scripts/apply-social-links.ts` | **New.** Owns all four social identity fields, derived from `data/settings.json`. |
| `scripts/merchandise.ts` | Fills collections from categories, enables homepage sections. `--dry-run` supported. |
| `scripts/purge-test-orders.ts` | Explicit id allow-list, `--dry-run` first. Never pattern-match orders for deletion. |
| `scripts/rewrite-legal.ts` | Regenerates `data/legal.json` from `constants/company.ts`. |
| `scripts/apply-company-details.ts` | Writes contact details into the live `SiteContent` row. |

## The obvious next steps

1. **Rename `PAYMENT_CONFIG_SECRET` → `PAYMENTS_CONFIG_SECRET`** in the Vercel dashboard.
2. **Create a second admin account.**
3. **Resend key + `EMAIL_FROM`** — until then no order confirmation, password reset or
   back-in-stock mail is actually sent; it only logs to `EmailLog`.
4. Real social profile URLs, or leave them empty.
5. A real domain, when there is one — then re-run `apply-site-url.ts` and redeploy.

`README.md` was rewritten in `6ac548c` — it had still described the pre-Postgres prototype
("payment is cosmetic only", "no API routes exist yet to rate-limit", mock auth, `data/*.json` as
the content source). It now describes what is actually deployed.
