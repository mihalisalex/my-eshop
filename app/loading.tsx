import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown by Next.js while a route segment's server data is loading. Generic by
 * necessity — this wraps every route (storefront, checkout, admin) — so it
 * stays a plain content-shaped skeleton rather than mimicking any one page.
 */
export default function RootLoading() {
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
