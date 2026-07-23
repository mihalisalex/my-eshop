import { NextResponse, type NextRequest } from "next/server";
import { getOAuthProvider, OAUTH_PROVIDER_NAMES, type OAuthProviderName } from "@/lib/oauth";
import { createOAuthState, isSafeRedirectPath, OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS } from "@/lib/oauth/state";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

function isKnownProvider(value: string): value is OAuthProviderName {
  return (OAUTH_PROVIDER_NAMES as string[]).includes(value);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isKnownProvider(provider)) {
    return NextResponse.json({ error: { code: "UNKNOWN_PROVIDER", message: "Unknown sign-in method." } }, { status: 404 });
  }

  const ip = getClientIp(request.headers);
  const key = `oauth-start:ip:${ip}:${provider}`;
  const limited = await isRateLimited({ key, limit: 20, windowMs: 15 * 60 * 1000 });
  if (limited.limited) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Try again shortly." } }, { status: 429 });
  }
  await recordAttempt(key);

  const client = getOAuthProvider(provider);
  if (!client) {
    return NextResponse.json({ error: { code: "PROVIDER_NOT_CONFIGURED", message: "This sign-in method isn't available." } }, { status: 404 });
  }

  const requestedFrom = request.nextUrl.searchParams.get("from") ?? "/account";
  const from = isSafeRedirectPath(requestedFrom) ? requestedFrom : "/account";

  const { cookieValue, state } = createOAuthState(from);
  const redirectUri = new URL(`/api/auth/oauth/${provider}/callback`, request.url).toString();
  const authorizeUrl = client.getAuthorizeUrl({ state, redirectUri });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, cookieValue, OAUTH_STATE_COOKIE_OPTIONS);
  return response;
}
