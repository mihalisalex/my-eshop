import { createMockCommerceProvider } from "@/lib/commerce/providers/mock";
import type { CommerceProvider } from "@/lib/commerce/types";

export * from "@/lib/commerce/types";

/**
 * The single switch statement in the whole codebase that knows adapters exist.
 * Everything else — components, hooks, services — only ever imports `CommerceProvider`
 * from `lib/commerce/types` and calls `getCommerceProvider()`.
 *
 * To add a real backend: implement the same 10 interfaces in
 * `lib/commerce/providers/<name>/`, aggregate them the way
 * `providers/mock/index.ts` does, and add a case below. No other file changes.
 *
 *   case "shopify":
 *     return createShopifyCommerceProvider({ domain, storefrontToken });
 *   case "woocommerce":
 *     return createWooCommerceProvider({ baseUrl, consumerKey, consumerSecret });
 *   case "medusa":
 *     return createMedusaCommerceProvider({ baseUrl, publishableKey });
 *   case "commercelayer":
 *     return createCommerceLayerProvider({ organization, clientId });
 */
function buildCommerceProvider(): CommerceProvider {
  const providerName = process.env.NEXT_PUBLIC_COMMERCE_PROVIDER ?? "mock";

  switch (providerName) {
    case "mock":
    default:
      return createMockCommerceProvider();
  }
}

let cachedProvider: CommerceProvider | null = null;

/** Lazily constructed singleton — call this instead of importing an adapter directly. */
export function getCommerceProvider(): CommerceProvider {
  if (!cachedProvider) cachedProvider = buildCommerceProvider();
  return cachedProvider;
}
