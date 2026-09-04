import "server-only";
import { OAuthError } from "@/lib/oauth/types";

/**
 * REL-001. Every OAuth provider makes the same shape of outbound call during sign-in, and
 * none of them bounded it — so a stalled identity provider held a sign-in request open until
 * the platform killed it.
 *
 * Shorter than the payment ceiling on purpose. A token exchange is a small, fast round trip
 * with no money attached: if the provider has not answered in this long it is not about to,
 * and the shopper is better served by a clean "try again" than by a spinner that ends in a
 * platform timeout page. Nothing is lost by failing early either — an unredeemed
 * authorization code simply expires, unlike an abandoned payment or courier voucher.
 */
const OAUTH_TIMEOUT_MS = 8_000;

/**
 * `fetch` with a deadline, and provider faults translated into `OAuthError` so every caller's
 * existing error handling covers the network path too.
 *
 * @param label names the provider and step ("Google token exchange") and appears verbatim in
 *   the error, which is what makes a log line legible without opening the code.
 */
export async function oauthFetch(url: URL | string, init: RequestInit | undefined, label: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new OAuthError(`${label} timed out after ${OAUTH_TIMEOUT_MS}ms.`);
    }
    // DNS, TLS or connection failure — distinct from a timeout, and worth saying so.
    throw new OAuthError(`${label} could not reach the provider: ${error instanceof Error ? error.message : String(error)}`);
  }
}
