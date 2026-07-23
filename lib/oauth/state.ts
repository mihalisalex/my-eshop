import "server-only";

export const OAUTH_STATE_COOKIE = "alexandris_oauth_state";
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

export interface OAuthStatePayload {
  state: string;
  /** Relative, same-origin path to return the customer to on success. Validated in isSafeRedirectPath. */
  from: string;
}

function randomToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

export function createOAuthState(from: string): { cookieValue: string; state: string } {
  const state = randomToken();
  return { cookieValue: JSON.stringify({ state, from } satisfies OAuthStatePayload), state };
}

export function parseOAuthState(cookieValue: string | undefined): OAuthStatePayload | null {
  if (!cookieValue) return null;
  try {
    const parsed = JSON.parse(cookieValue);
    if (typeof parsed?.state !== "string" || typeof parsed?.from !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Only ever redirect back into this same site — the `from` value round-trips through a
 * cookie a client fully controls, so an absolute/protocol-relative URL must never be honored. */
export function isSafeRedirectPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

/**
 * Cookie attributes for the transient OAuth CSRF-state cookie. `sameSite: "none"` (not
 * "lax") is required here specifically for Apple: its callback is a cross-site POST
 * (response_mode=form_post), and a Lax cookie is not sent on a cross-site POST — only on
 * top-level GET navigation. `secure: true` is required by browsers for `sameSite: "none"`,
 * which also means the Apple flow cannot be exercised over plain http://localhost — not a
 * practical loss, since Apple's own developer portal requires a verified https domain for
 * the redirect URI anyway (localhost isn't a valid Apple return URL either way).
 */
export const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  path: "/api/auth/oauth",
  maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
};
