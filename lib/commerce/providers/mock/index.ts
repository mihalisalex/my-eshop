import { createRemoteProductService } from "@/lib/commerce/providers/remote/product.service";
import { createRemoteCollectionService } from "@/lib/commerce/providers/remote/collection.service";
import { createRemoteCartService } from "@/lib/commerce/providers/remote/cart.service";
import { createRemoteCheckoutService } from "@/lib/commerce/providers/remote/checkout.service";
import { createRemoteCustomerService } from "@/lib/commerce/providers/remote/customer.service";
import { createRemoteWishlistService } from "@/lib/commerce/providers/remote/wishlist.service";
import { createRemoteAuthenticationService } from "@/lib/commerce/providers/remote/auth.service";
import { createMockSearchService } from "@/lib/commerce/providers/mock/search.service";
import { createMockCMSService } from "@/lib/commerce/providers/mock/cms.service";
import { createMockAnalyticsService } from "@/lib/commerce/providers/mock/analytics.service";
import type { CommerceProvider } from "@/lib/commerce/types";

/**
 * Composition root for the client-side commerce provider. Every dependency is
 * constructed here and injected into the services that need it (e.g.
 * SearchService needs ProductService to resolve results).
 *
 * As of Real Backend Phase 2, only CMS/Search/Analytics remain genuinely
 * mock/localStorage-backed — Products, Collections, Cart, Checkout, Customer,
 * Wishlist, and Auth are all Postgres-backed via Route Handler facades (this
 * factory only ever runs in the browser, so it can't import Prisma-backed
 * services directly). The exported name (`createMockCommerceProvider`,
 * `name: "mock"`) is kept for now — a pure rename with nonzero blast radius
 * across every import site, deferred past this phase.
 */
export function createMockCommerceProvider(): CommerceProvider {
  const products = createRemoteProductService();

  return {
    name: "mock",
    products,
    collections: createRemoteCollectionService(),
    cart: createRemoteCartService(),
    checkout: createRemoteCheckoutService(),
    customer: createRemoteCustomerService(),
    wishlist: createRemoteWishlistService(),
    search: createMockSearchService(products),
    cms: createMockCMSService(),
    auth: createRemoteAuthenticationService(),
    analytics: createMockAnalyticsService(),
  };
}
