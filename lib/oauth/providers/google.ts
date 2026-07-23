import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { OAuthError, type ExchangeCodeParams, type OAuthProfile, type OAuthProviderClient } from "@/lib/oauth/types";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUER = "https://accounts.google.com";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
}

/** Standard OAuth2/OIDC authorization-code flow, ID-token verified against Google's published JWKS. */
export function createGoogleOAuthProvider(creds: GoogleCredentials): OAuthProviderClient {
  return {
    getAuthorizeUrl({ state, redirectUri }) {
      const url = new URL(AUTHORIZE_URL);
      url.searchParams.set("client_id", creds.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      return url.toString();
    },

    async exchangeCode({ code, redirectUri }: ExchangeCodeParams): Promise<OAuthProfile> {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new OAuthError(`Google token exchange failed (${res.status}): ${text.slice(0, 500)}`);

      const body = JSON.parse(text) as { id_token?: string };
      if (!body.id_token) throw new OAuthError("Google token response did not include an id_token.");

      const { payload } = await jwtVerify(body.id_token, JWKS, { issuer: ISSUER, audience: creds.clientId });
      if (typeof payload.sub !== "string") throw new OAuthError("Google id_token missing sub claim.");

      return {
        providerUserId: payload.sub,
        email: typeof payload.email === "string" ? payload.email : null,
        firstName: typeof payload.given_name === "string" ? payload.given_name : null,
        lastName: typeof payload.family_name === "string" ? payload.family_name : null,
      };
    },
  };
}
