import "server-only";
import { oauthFetch } from "@/lib/oauth/fetch";
import { OAuthError, type ExchangeCodeParams, type OAuthProfile, type OAuthProviderClient } from "@/lib/oauth/types";

const GRAPH_VERSION = "v21.0";
const AUTHORIZE_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const TOKEN_URL = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
const PROFILE_URL = `https://graph.facebook.com/${GRAPH_VERSION}/me`;

export interface FacebookCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Facebook Login via the Graph API — pure OAuth2, no ID token. The access token itself
 * isn't a verifiable identity claim, so the profile is fetched live from `/me` rather
 * than trusted from a payload, mirroring how lib/courier's ACS provider treats every
 * vendor response as untrusted until parsed.
 */
export function createFacebookOAuthProvider(creds: FacebookCredentials): OAuthProviderClient {
  return {
    getAuthorizeUrl({ state, redirectUri }) {
      const url = new URL(AUTHORIZE_URL);
      url.searchParams.set("client_id", creds.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set("scope", "email,public_profile");
      return url.toString();
    },

    async exchangeCode({ code, redirectUri }: ExchangeCodeParams): Promise<OAuthProfile> {
      const tokenUrl = new URL(TOKEN_URL);
      tokenUrl.searchParams.set("client_id", creds.clientId);
      tokenUrl.searchParams.set("client_secret", creds.clientSecret);
      tokenUrl.searchParams.set("redirect_uri", redirectUri);
      tokenUrl.searchParams.set("code", code);

      const tokenRes = await oauthFetch(tokenUrl, undefined, "Facebook token exchange");
      const tokenText = await tokenRes.text();
      if (!tokenRes.ok) throw new OAuthError(`Facebook token exchange failed (${tokenRes.status}): ${tokenText.slice(0, 500)}`);

      const tokenBody = JSON.parse(tokenText) as { access_token?: string };
      if (!tokenBody.access_token) throw new OAuthError("Facebook token response did not include an access_token.");

      const profileUrl = new URL(PROFILE_URL);
      profileUrl.searchParams.set("fields", "id,email,first_name,last_name");
      profileUrl.searchParams.set("access_token", tokenBody.access_token);

      const profileRes = await oauthFetch(profileUrl, undefined, "Facebook profile fetch");
      const profileText = await profileRes.text();
      if (!profileRes.ok) throw new OAuthError(`Facebook profile fetch failed (${profileRes.status}): ${profileText.slice(0, 500)}`);

      const profile = JSON.parse(profileText) as { id?: string; email?: string; first_name?: string; last_name?: string };
      if (!profile.id) throw new OAuthError("Facebook profile response did not include an id.");

      return {
        providerUserId: profile.id,
        email: profile.email ?? null,
        firstName: profile.first_name ?? null,
        lastName: profile.last_name ?? null,
      };
    },
  };
}
