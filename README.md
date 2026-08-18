# ALEXANDRIS

A luxury footwear ecommerce shop — Zara/COS-inspired minimal editorial design — **live in production** at [shopalexandris.vercel.app](https://shopalexandris.vercel.app), selling a real catalogue and taking real orders.

Storefront, checkout, payments, transactional email, courier integration and a full admin dashboard are all real and Postgres-backed. It is built on a vendor-neutral commerce abstraction, so a different backend (Shopify, WooCommerce, Medusa, Commerce Layer) could be swapped in by writing adapters rather than rewriting the app.

Two things are deliberately not connected yet, and the shop is honest about both rather than faking them: **card payments** (Stripe is code-complete and unit-tested but has no keys, so checkout offers Cash on Delivery only) and **outbound email** (no `EMAIL_PROVIDER` is set, so mail is written to the `EmailLog` table and never delivered).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · Prisma 7 + Neon Postgres · Framer Motion · React Hook Form + Zod · next-intl · Vercel Blob · Resend · Vitest

## Getting Started

```bash
npm install
```

Copy `.env.example` to `.env` and fill it in. `DATABASE_URL` (a Neon pooled connection string), `ADMIN_SESSION_SECRET` and `CUSTOMER_SESSION_SECRET` are the minimum needed to boot; everything else degrades gracefully when unset, which is the point — an unconfigured provider hides its UI or falls back to a safe local default rather than erroring.

```bash
npx prisma migrate deploy
npx tsx scripts/seed.ts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the storefront, or [http://localhost:3000/admin](http://localhost:3000/admin) for the dashboard.

**Admin access.** Authentication is real: an `AdminUser` row in Postgres, a bcrypt-hashed password, and a `jose`-signed JWT session cookie enforced by `proxy.ts`.

There are **no demo credentials** and nothing is pre-filled on the login form. `scripts/seed.ts` creates the first admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, and if those are unset it generates a random password and prints it once:

```
Created admin user admin@example.com.
Password: kW3f9Qx7_pR2vNc1LtYbHs4A
This is shown ONCE and is not stored anywhere in plaintext.
```

This used to be a hardcoded `admin123` exported from `lib/auth.ts` and published here. In a public repository that is a working login to the account that can edit prices, read customer addresses and delete orders — it only had to be seeded once against a real database to become real.

Re-running the seed never touches an existing admin. After the first one, manage admins at `/admin/users` (create, delete, self-service password change, with guards against deleting yourself or the last remaining admin).

### Before deploying

```bash
npx tsx scripts/check-launch-placeholders.ts
```

Fails loudly if placeholder content is still in the repo. It exists because a "This Is a Demo" Privacy Policy section and an unreachable `.example` contact address both survived on the live storefront long enough to stop being noticed — the failure mode is that nobody looks.

## Architecture

Nothing renders hardcoded content. Every component is prop-driven and reads through one seam:

```
Postgres            → the source of truth (Prisma, prisma/schema.prisma)
data/*.json         → FALLBACKS only, used when a SiteContent row is missing,
                       and the seed input for scripts/seed.ts
services/*.ts       → content + domain functions (products, collections, nav,
                       homepage, blog, settings, search, payments)
lib/commerce/       → the vendor-neutral commerce abstraction —
                       Cart, Checkout, Customer, Wishlist, Search, Auth, Analytics
components/         → ui/ (shadcn primitives), layout/, sections/, product/,
                       cart/, admin/, shared/
types/              → the domain model (Product, Collection, HomepageSection
                       as a discriminated union, etc.)
```

**The `data/*.json` files are fallbacks, not content.** The running shop reads the database. Editing one of them changes nothing a visitor sees unless the corresponding `SiteContent` row is missing — which is exactly how a demo domain once survived in every canonical URL while the repo looked correct. The `scripts/apply-*.ts` scripts exist to write these values into the live rows.

### Commerce Provider abstraction

`lib/commerce/types.ts` defines ten vendor-neutral service interfaces (`ProductService`, `CollectionService`, `CartService`, `CheckoutService`, `CustomerService`, `WishlistService`, `SearchService`, `CMSService`, `AuthenticationService`, `AnalyticsService`) aggregated into one `CommerceProvider`. No component ever imports a vendor SDK. `lib/commerce/index.ts` is the single factory (`getCommerceProvider()`), and it is the only switch statement in the codebase that knows adapters exist.

Eight of the ten — Products, Collections, Cart, Checkout, Customer, Wishlist, Auth and Search — are **Postgres-backed** through Route Handler facades, because this factory only ever runs in the browser and so cannot import Prisma-backed services directly. Only CMS and Analytics remain locally implemented. The exported name `createMockCommerceProvider` is legacy from when all ten were mocks; renaming it touches every import site and has been deferred.

Dependency injection throughout: `SearchService` takes `ProductService` as a constructor argument rather than reaching into storage itself.

### Payments

See **`PAYMENTS.md`** for the full guide. Checkout → payment abstraction → selected provider. The checkout knows only `PaymentMethod` / `PaymentIntent` / `PaymentStatus` / `PaymentResult` and takes exactly one behavioural branch (`customerAction.type === "redirect"`), which is about the action, not the vendor. Adding a provider is a new file plus one registry line.

- **Cash on Delivery** and **Direct Bank Transfer** — real and complete, no external account needed. Bank transfer deliberately has no `awaiting_bank_transfer → processing` edge in its state machine: creating the order does not mark it paid, because there is no automatic path to settlement.
- **Stripe** — code-complete and unit-tested against its hosted checkout. Needs keys.
- **IRIS** and **Piraeus Bank** — deliberate integration *boundaries*. The provider, config screen, webhook endpoint and registry entry all exist, but payment creation refuses rather than guessing an undocumented bank API. They cannot reach checkout in this state.

Provider credentials are AES-256-GCM encrypted at rest with a key derived from `PAYMENTS_CONFIG_SECRET`; a missing key is a hard error at the point of use rather than a silent fallback to a hardcoded default. Every provider can also be configured entirely through environment variables (`<PROVIDER_ID>_<FIELD_KEY>`, upper-snake-cased), which is the right choice in production — an env var always wins over an admin-saved value, and the admin shows such a field as read-only rather than pretending a write took effect.

Payment status is tracked separately from order status, with an append-only `payment_transactions` audit trail and a single server-side `assertTransition` chokepoint.

### Checkout

`/checkout` is a multi-step guest checkout (contact → shipping → delivery → payment → review). Orders, carts and checkouts are all persisted in Postgres. VAT is **inclusive** at the Greek 24% — `vatIncludedIn()` is `gross × rate / (1 + rate)`, not `gross × rate`; confusing those two is a real bug this codebase has already had, which is why it is one named function. VAT is computed on the pre-gift-card total, because a gift card is a means of payment rather than a price reduction.

Delivery estimates skip Greek public holidays, including the Orthodox Easter cluster.

### Authentication & account

Customers get real email/password auth plus **Google, Facebook and Apple OAuth** (`lib/oauth/`). Each provider's button simply doesn't render until its credentials are set, so an unconfigured provider degrades rather than erroring. Sessions are signed JWTs in cookies, with `CUSTOMER_SESSION_SECRET` deliberately separate from `ADMIN_SESSION_SECRET` so compromising one doesn't compromise the other. Password reset works end to end (request → emailed token → single-use redemption).

`/account/login` and `/account/register` are public; the rest of `/account` is behind a route-group layout that redirects signed-out visitors. `/wishlist` stays guest-accessible.

### Search

Storefront search and all listing-page filtering run **in Postgres** (`services/search.ts`, `/api/search`). One request returns a page of results, the facet counts and the price bounds together.

It uses raw SQL rather than the query builder for a specific reason: every price rule operates on the effective price, `COALESCE(salePrice, price)`, which Prisma cannot express in `where`/`orderBy` — and almost every product carries a sale price. Facets count the *scope*, not the refined set, so picking one colour doesn't zero every other. Every sort carries `p.id` as a tiebreaker; without a total order, equal-priced products swap between pages and one is never seen.

The header overlay is instant search — debounced live queries, inline product and collection previews, keyboard navigation. There is no `/search` results page, so results are not currently linkable or shareable.

### Product listing pages

`/women`, `/men`, `/new-in`, `/sale`, `/collections` and `/collections/[slug]` share one template, `components/plp/ProductListingPage.tsx`: colour/size/price/availability filters with faceted counts, sort and infinite scroll, all driven by the URL (`?color=&size=&minPrice=&sort=&page=`) so any filtered view is a shareable link.

`/new-in` sorts by when a product was actually added rather than filtering on a badge, so it stays correct on its own as stock arrives.

### Product model & detail page

`types/product.ts` covers multi-image galleries, product video, per-size inventory (`quantity`, SKU, barcode), preorder/backorder, gender/season/materials/care, related products and an SEO override. `lib/product.ts` centralises derived logic (`getEffectivePrice`, `getProductBadges`, `isSizePurchasable`) so pricing and badge rules live in exactly one place.

Scarcity badges count **sizes remaining, not total units**. This shop carries roughly one pair per size, so counting units made the badge fire on 90% of the catalogue, which tells a shopper nothing. "Last size" and "Few sizes left" are also distinguished, because they are different messages to someone deciding whether to buy now.

There is no "N people bought this recently" indicator. There was one; it was a hash of the SKU rather than a fact, so it was deleted rather than flagged off.

### Cart

Postgres-backed, with promo codes, gift cards, automatic VAT and free-shipping-threshold calculation, saved-for-later, recommendations and stock-aware quantity limits. `CartDrawer` and `/cart` share one `useCart()` hook.

### Admin dashboard

`/admin` covers products, a variant editor (stock is tracked per size, not per colour×size), inventory, collections and categories, discounts, gift cards, orders, customers, returns, analytics, the homepage sections builder with a real draft/publish workflow, hero management, a media library with real uploads to Vercel Blob, navigation, blog posts, SEO and site settings, and users. **Everything persists to Postgres.**

Roles are enforced, not decorative: `constants/permissions.ts` holds 13 keyed capabilities used by both the UI and the server-side guard on every mutation. Orders and inventory page, search and filter in SQL rather than shipping the whole table to the browser.

Renaming a category records its outgoing slug in the same transaction, so old URLs 308 rather than 404 — the redirect lives in `proxy.ts`, not the page, because `permanentRedirect` in a streaming context emits a client-side meta refresh rather than a real 308.

Stock is restored when an order is cancelled or refunded, claimed via a null-guarded `Order.restockedAt` so a re-save cannot double-credit. **Returns do not yet restock** — that is a separate path needing its own per-item claim column.

### Integrations

All follow the same pattern: an interface, a safe default, and a real implementation that activates only once credentials exist.

| Integration | Default | Real |
|---|---|---|
| Email | `dev` — writes to `EmailLog`, sends nothing | Resend |
| Courier | `manual` — admin types a tracking number | ACS Courier |
| Image storage | disabled, with a clear "not configured" error | Vercel Blob |
| OAuth | button hidden | Google, Facebook, Apple |

### Security & polish

Rate limiting on write endpoints and the catalogue query. Real security response headers, with no `unsafe-eval` in the production CSP, plus `base-uri`, `form-action` and `object-src`. Branded `error.tsx` / `global-error.tsx` / `not-found.tsx`. A structured `lib/logger.ts`. Cookie consent with a real gate.

**Do not add a `loading.tsx` to any route that calls `notFound()`.** A Suspense boundary commits HTTP 200 before `notFound()` can run, which turned every missing product, category, collection and legal page into a soft 404 across the whole app. The root loader is scoped to an `app/(listing)/` route group covering only pages that cannot 404.

## SEO

Metadata API with per-page `generateMetadata`, JSON-LD (Organization with real trader identity + WebSite site-wide; Product and Breadcrumb on product pages), `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`, `app/opengraph-image.tsx`.

`robots.txt` and `sitemap.xml` are **statically prerendered** — they bake database values at build time, so changing the site URL in the database needs a redeploy before they update. Canonical tags are dynamic and change immediately.

The site URL lives in three places that must agree: the live `SiteContent` "seo" row, `data/seo.json` as its fallback, and `NEXT_PUBLIC_SITE_URL` for links inside emails sent from contexts with no incoming request. `scripts/apply-site-url.ts` handles the database half.

## Legal

`data/legal.json` is generated by `scripts/rewrite-legal.ts` from `constants/company.ts`, so the registered trader identity exists in exactly one place and cannot drift between the footer, the contact page, three legal documents and the structured data. The documents are written for a Greek distance seller: lawful bases, processors, retention, GDPR rights and the Hellenic DPA, the 14-day statutory withdrawal right alongside the shop's own 30-day returns policy, the ODR platform and the Consumer's Ombudsman.

`legalName` and `brandName` are deliberately separate fields — legal documents must name the trader as registered, since using the trading name in a Privacy Policy defeats the point of naming the data controller.

## Testing

```bash
npm test          # vitest, 186 tests
npx tsc --noEmit
npx eslint
```

## Not Yet Built

By design: **card payments** (Stripe needs keys, not code), **outbound email** (Resend needs a key), real multi-currency conversion (totals are currency-aware but only ever computed in EUR), restocking on returns, and full Greek localisation — `messages/el.json` covers the UI strings but there are no locale URLs or `hreflang`, so only one language is indexable.

See `PROGRESS.md` for the full build log and `NOTES.md` for the current session's state.
