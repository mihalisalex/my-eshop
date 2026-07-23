export type OAuthProviderName = "google" | "apple" | "facebook";

export const OAUTH_PROVIDER_NAMES: OAuthProviderName[] = ["google", "apple", "facebook"];

export interface OAuthProfile {
  /** The provider's stable subject identifier — Google/Apple `sub`, Facebook `id`. Never the email, which can change. */
  providerUserId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface ExchangeCodeParams {
  code: string;
  redirectUri: string;
  /**
   * Raw callback params — the query string for GET-callback providers (Google,
   * Facebook), or the parsed form body for Apple's POST (response_mode=form_post).
   * Apple's provider reads its one-time `user` JSON field out of this; the other
   * providers ignore it.
   */
  rawParams: Record<string, string>;
}

/**
 * Vendor-neutral seam for OAuth login — same shape as `lib/email`/`lib/courier`'s
 * one-interface-many-vendors pattern, except all three providers can be configured
 * and active simultaneously (see lib/oauth/index.ts's getOAuthProvider), rather than
 * one active provider selected by an env switch.
 */
export interface OAuthProviderClient {
  getAuthorizeUrl(params: { state: string; redirectUri: string; nonce?: string }): string;
  exchangeCode(params: ExchangeCodeParams): Promise<OAuthProfile>;
}

export class OAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthError";
  }
}
