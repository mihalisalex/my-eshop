# ALEXANDRIS

A luxury fashion ecommerce platform foundation — Zara/COS-inspired minimal editorial design, built on a vendor-neutral commerce abstraction so a real backend (Shopify, WooCommerce, Medusa, Commerce Layer, a custom API) can be plugged in by writing adapters, not by rewriting the app. Storefront, admin dashboard, product detail pages, and a fully working cart are all in place; checkout, real payment, and real auth are the deliberate edge of "foundation" (see "Not Yet Built").

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · Framer Motion · Lucide Icons · React Hook Form + Zod · Next.js Metadata API

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the storefront, or [http://localhost:3000/admin](http://localhost:3000/admin) for the dashboard.

**Admin demo login:** `admin@alexandris-demo.example` / `admin123` (pre-filled on the login form). This is mock authentication (a signed cookie set by a Server Action, checked by `proxy.ts`) — swap `lib/auth.ts` for a real provider before shipping.

## Architecture

Nothing renders hardcoded content. Every component is prop-driven and reads through one seam:

```
data/*.json        → mock content, shaped like a future API response
services/*.ts       → CMS/content-layer functions (products, collections, nav,
                       homepage, blog, settings) reading data/ today
lib/commerce/       → the vendor-neutral commerce abstraction (see below) —
                       Cart, Checkout, Customer, Wishlist, Search, Auth, Analytics
components/         → ui/ (shadcn primitives), layout/ (header, footer, nav),
                       sections/ (homepage blocks), product/, cart/, admin/, shared/
types/              → the domain model (Product, Collection, HomepageSection
                       as a discriminated union, etc.) — the contract
                       everything else is built against
```

### CMS abstraction

`CMSService` (part of the same `lib/commerce/types.ts` interface set) covers Homepage, Navigation, Settings, Blog/Journal, About, Campaigns, Lookbooks, and Landing Pages — each with its own `data/*.json` + `services/*.ts`, wired through the one mock adapter in `lib/commerce/providers/mock/cms.service.ts`. Swapping in a real headless CMS (Sanity, Strapi, Contentful) means writing one new adapter file against this same interface — no component changes. Landing pages (`/landing/[slug]`) are the clearest proof this works end-to-end: a landing page is just a `HomepageSection[]` at an arbitrary slug, rendered by the exact same `SectionRenderer` the homepage uses, so a whole new page type costs nothing beyond a route and a data file. Collections deliberately stay under the separate `CollectionService` rather than folding into CMS — they're a merchandising concern (pricing, availability, product membership), not editorial content.

### Commerce Provider abstraction

`lib/commerce/types.ts` defines ten vendor-neutral service interfaces (`ProductService`, `CollectionService`, `CartService`, `CheckoutService`, `CustomerService`, `WishlistService`, `SearchService`, `CMSService`, `AuthenticationService`, `AnalyticsService`) aggregated into one `CommerceProvider`. `lib/commerce/providers/mock/` implements all ten against `services/*.ts` and `localStorage` — no component ever imports a vendor SDK. `lib/commerce/index.ts` is the single factory (`getCommerceProvider()`, env-driven via `NEXT_PUBLIC_COMMERCE_PROVIDER`) — adding a real backend means implementing the same interfaces under `lib/commerce/providers/<name>/` and adding one case there. Dependency injection is used throughout (e.g. `CartService` and `SearchService` both take `ProductService` as a constructor argument rather than reaching into storage themselves).

Cart and Wishlist state is bridged into React via `components/providers/CartProvider.tsx` and `WishlistProvider.tsx` (optimistic updates, undo-on-remove, a small custom toast system in `components/providers/ToastProvider.tsx`). Both are mounted once in the root layout.

### Product model (Phase 2)

`types/product.ts` covers multi-image galleries, product video, per-size inventory (`quantity`, SKU, barcode), preorder/backorder, gender/season/materials/care instructions, explicit or category-derived related products, and an SEO override. `lib/product.ts` centralizes the derived logic (`getEffectivePrice`, `getProductBadges`, `isSizePurchasable`, low-stock detection) so pricing/badge rules live in exactly one place.

### Product Detail Page

`app/products/[slug]/page.tsx` (statically generated via `generateStaticParams`) composes a zoomable/video-capable `Gallery`, a sticky `PurchasePanel` (variant selectors, size guide, quantity, recently-purchased indicator, delivery estimate), a `ProductAccordion` (fit, care, shipping, returns), reviews (`data/reviews.json`, future-ready for real submissions), related products, and a `RecentlyViewedSection` backed by `hooks/use-recently-viewed.ts`. Product + Breadcrumb JSON-LD included.

### Cart system

Persistent, localStorage-backed guest cart with promo codes (validated against the same `data/discounts.json` the admin manages), mock gift cards, automatic VAT + free-shipping-threshold calculation, saved-for-later, cart recommendations, and stock-aware quantity limits. `components/cart/CartDrawer.tsx` (slide-in, opens on add) and `app/cart/page.tsx` (full page) share the same `useCart()` hook, which also exposes `clearCart()` — used by checkout on order completion so cart UI state stays in sync everywhere.

The homepage is a config-driven list of sections (`data/homepage.json`), rendered by `components/sections/SectionRenderer.tsx`. The admin's Homepage Sections editor (`/admin/homepage`) edits that same shape. Changes are in-memory only; wire `services/homepage.ts` to a real persistence layer to make Save/Publish real.

### Search

The header's search overlay (`components/layout/SearchOverlay.tsx`) is instant search, not a static input: debounced (250ms) live queries against `SearchService`, inline product and collection preview results, trending searches (`data/trending-searches.json`) and localStorage-backed recent searches shown when the query is empty, and full keyboard navigation (arrow keys, Enter, Escape). Matching covers name, description, category, tags, materials, SKU, color, and size. There's no separate `/search` results page by design — results render inline in the overlay.

### Product listing pages

`/women`, `/men`, `/new-in`, `/sale`, `/collections`, and `/collections/[slug]` all share one template, `components/plp/ProductListingPage.tsx`: color/size/price/availability filters with faceted counts, sort, and infinite scroll — all driven by the URL (`?color=&size=&minPrice=&sort=&page=`), so any filtered view is a shareable link. Filtering runs through the same `SearchService` the header's search overlay uses, just scoped by `gender`/`isNew`/`isSale`/`collectionId` instead of a text query.

### Authentication & account

`components/providers/AuthProvider.tsx` (`useAuth()`) wraps the mock `AuthenticationService` — email/password, a cosmetic "magic link" mode, and Google/Apple/Facebook buttons that are honest visual placeholders (same pattern as Express Checkout). `/account/login` and `/account/register` are public; everything else (`/account`, `/orders`, `/addresses`, `/returns`, `/profile`, `/preferences`, `/security`) lives under a route-group layout that redirects signed-out visitors to login. `/wishlist` stays a top-level, guest-accessible route. Addresses saved in the account carry over into checkout as a prefill for signed-in shoppers; guest checkout is untouched.

### Checkout

`/checkout` is a multi-step guest checkout (contact → shipping → delivery → payment → review) driven by `components/providers/CheckoutProvider.tsx` and `CheckoutService`. Address autocomplete (`lib/address-autocomplete.ts`) is a mock Places-style dataset — swap that one module for a real provider. Payment is cosmetic only: card fields validate client-side (Luhn-length regex, no real card network), Apple Pay/Google Pay/PayPal/Klarna are visual placeholders that toast "not connected in this demo," and the Payment step carries a small disclaimer that no payment is charged. Placing an order clears the cart, hands the `Order` to `/checkout/confirmation` via `sessionStorage` (a one-off UI handoff, not a persisted lookup), and shows the order recap.

### Admin dashboard

`/admin` (mock-authenticated, see below) covers product management, a variant editor (colors and per-size inventory — the real data model tracks stock per size, not per color×size combination), inventory, collections/categories, discounts, gift cards, orders, customers, returns, an analytics view (revenue/AOV/orders-by-status/top customers derived from the mock data, no chart library), the homepage sections builder (with a real draft/publish workflow), hero management, media library, navigation menu, blog posts, SEO/site settings, and users with a roles & permissions reference matrix. Every admin form saves to local component state only ("Saved" confirmation, no persistence) — that's a deliberate, consistent placeholder across the whole section, not a per-page oversight; wiring real persistence means picking one pattern (a backend, or e.g. `services/*.ts` writing through an API) and applying it everywhere at once.

### Enterprise polish

Branded `error.tsx`/`global-error.tsx`/`not-found.tsx` (replacing Next's defaults), a generic `loading.tsx` skeleton, shimmer blur placeholders on product images, a local feature-flag registry (`lib/feature-flags.ts`, gating Express Checkout, Klarna, and magic-link sign-in as live proof-of-concept), a structured `lib/logger.ts`, and real security response headers (`next.config.ts` — X-Frame-Options, CSP, HSTS, etc., `curl`-verified). Explicitly **not** implemented, by design, rather than faked: a service worker/offline support, i18n/RTL, Sentry, real A/B testing, rate-limiting (no API routes exist yet to rate-limit), a dedicated image CDN, and edge caching (nearly the entire app is already static/SSG since all "backend" state is `localStorage`-based) — see `PROGRESS.md` for why each is a deliberate gap, not an oversight.

## SEO

Metadata API (per-page `generateMetadata`), JSON-LD (Organization + WebSite site-wide; Product/Breadcrumb live on product pages, FAQ helper in `lib/seo.ts` ready), `app/robots.ts`, `app/sitemap.ts` (products/collections/journal posts included), `app/manifest.ts`, `app/icon.svg`, `app/opengraph-image.tsx` (dynamic OG card via `next/og`).

## Not Yet Built

By design: real payment processing (checkout UI exists, gateway is cosmetic), real OAuth (Google/Apple/Facebook buttons are visual placeholders), multi-language, and real multi-currency conversion (the cart's totals are currency-aware but only ever computed in one active currency today). The types and services are shaped so each is additive.
