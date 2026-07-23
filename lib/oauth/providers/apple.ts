import "server-only";
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from "jose";
import { OAuthError, type ExchangeCodeParams, type OAuthProfile, type OAuthProviderClient } from "@/lib/oauth/types";

const AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize";
const TOKEN_URL = "https://appleid.apple.com/auth/token";
const ISSUER = "https://appleid.apple.com";
const JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export interface AppleCredentials {
  teamId: string;
  clientId: string; // the registered Services ID
  keyId: string;
  /** Contents of the downloaded .p8 private key file (PEM, PKCS8 EC). `\n` may be literal (env var escaping) — normalized before use. */
  privateKey: string;
}

async function mintClientSecret(creds: AppleCredentials): Promise<string> {
  const pem = creds.privateKey.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: creds.keyId })
    .setIssuer(creds.teamId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setAudience(ISSUER)
    .setSubject(creds.clientId)
    .sign(key);
}

/**
 * Sign in with Apple. Two quirks that make this the most complex of the three:
 *
 * 1. `response_mode=form_post` — Apple POSTs the callback (form-encoded body), it
 *    never uses a GET redirect. The callback route must accept POST for this provider.
 * 2. Name is a one-time gift: the POST body's `user` field (JSON: `{name, email}`) is
 *    only ever sent on the customer's FIRST authorization. `rawParams.user` is read
 *    here for that reason; on every later login it's simply absent (returns null),
 *    which is expected Apple behavior, not a bug — the name was already persisted on
 *    the Customer/CustomerOAuthAccount rows at first link. Email, by contrast, comes
 *    from the id_token's `email` claim and is present on every login.
 */
export function createAppleOAuthProvider(creds: AppleCredentials): OAuthProviderClient {
  return {
    getAuthorizeUrl({ state, redirectUri }) {
      const url = new URL(AUTHORIZE_URL);
      url.searchParams.set("client_id", creds.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "name email");
      url.searchParams.set("response_mode", "form_post");
      url.searchParams.set("state", state);
      return url.toString();
    },

    async exchangeCode({ code, redirectUri, rawParams }: ExchangeCodeParams): Promise<OAuthProfile> {
      const clientSecret = await mintClientSecret(creds);
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: creds.clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new OAuthError(`Apple token exchange failed (${res.status}): ${text.slice(0, 500)}`);

      const body = JSON.parse(text) as { id_token?: string };
      if (!body.id_token) throw new OAuthError("Apple token response did not include an id_token.");

      const { payload } = await jwtVerify(body.id_token, JWKS, { issuer: ISSUER, audience: creds.clientId });
      if (typeof payload.sub !== "string") throw new OAuthError("Apple id_token missing sub claim.");

      let firstName: string | null = null;
      let lastName: string | null = null;
      if (typeof rawParams.user === "string") {
        try {
          const user = JSON.parse(rawParams.user) as { name?: { firstName?: string; lastName?: string } };
          firstName = user.name?.firstName ?? null;
          lastName = user.name?.lastName ?? null;
        } catch {
          // Malformed `user` field — proceed without a name rather than failing the whole sign-in.
        }
      }

      return {
        providerUserId: payload.sub,
        email: typeof payload.email === "string" ? payload.email : null,
        firstName,
        lastName,
      };
    },
  };
}
