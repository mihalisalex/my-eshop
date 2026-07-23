import "server-only";
import { createGoogleOAuthProvider } from "@/lib/oauth/providers/google";
import { createFacebookOAuthProvider } from "@/lib/oauth/providers/facebook";
import { createAppleOAuthProvider } from "@/lib/oauth/providers/apple";
import type { OAuthProviderClient, OAuthProviderName } from "@/lib/oauth/types";

export * from "@/lib/oauth/types";

/**
 * Unlike lib/email/lib/courier (one active provider, selected by an env switch), all
 * three OAuth providers can be configured and active at the same time — a provider
 * whose env vars are unset simply returns null here (its login button stays hidden),
 * there's no shared fallback to silently substitute.
 */
export function getOAuthProvider(name: OAuthProviderName): OAuthProviderClient | null {
  switch (name) {
    case "google": {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) return null;
      return createGoogleOAuthProvider({ clientId, clientSecret });
    }
    case "facebook": {
      const clientId = process.env.FACEBOOK_CLIENT_ID;
      const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;
      if (!clientId || !clientSecret) return null;
      return createFacebookOAuthProvider({ clientId, clientSecret });
    }
    case "apple": {
      const teamId = process.env.APPLE_TEAM_ID;
      const clientId = process.env.APPLE_CLIENT_ID;
      const keyId = process.env.APPLE_KEY_ID;
      const privateKey = process.env.APPLE_PRIVATE_KEY;
      if (!teamId || !clientId || !keyId || !privateKey) return null;
      return createAppleOAuthProvider({ teamId, clientId, keyId, privateKey });
    }
    default:
      return null;
  }
}

export function getConfiguredOAuthProviders(): Record<OAuthProviderName, boolean> {
  return {
    google: getOAuthProvider("google") !== null,
    apple: getOAuthProvider("apple") !== null,
    facebook: getOAuthProvider("facebook") !== null,
  };
}
