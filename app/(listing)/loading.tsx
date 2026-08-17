import { Skeleton } from "@/components/ui/skeleton";

/**
 * Product-grid skeleton for the listing routes only.
 *
 * This used to live at `app/loading.tsx`, covering every route in the app — and that
 * was a silent SEO bug, not just an over-broad skeleton. A root `loading.tsx` wraps
 * every route in a Suspense boundary, so Next flushes the shell (committing HTTP 200)
 * before the page component resolves. By the time a page called `notFound()` the status
 * was already sent, so every missing product, category, collection, journal post and
 * legal page returned **200 with the not-found body** — a soft 404, which lets Google
 * index nonexistent URLs as real pages. Verified against a production build: with the
 * root loading.tsx present `/products/does-not-exist` returned 200; with it removed the
 * same URL returns 404.
 *
 * So the boundary now only covers routes that CANNOT 404 — the fixed listing pages,
 * which are also the only ones a product-grid skeleton ever suited. Detail routes
 * (`/products/[slug]`, `/category/[slug]`, `/collections/[slug]`, `/journal/[slug]`,
 * `/legal/[slug]`, …) deliberately have no loading boundary so their `notFound()` can
 * still set a real 404.
 *
 * Adding a `loading.tsx` to any route that calls `notFound()` reintroduces the bug.
 */
export default function ListingLoading() {
  return (
    <div className="container-luxe pt-header py-10">
      <Skeleton className="h-8 w-48" />
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <Skeleton className="aspect-3/4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
