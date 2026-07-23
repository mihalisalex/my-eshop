import { NextResponse, type NextRequest } from "next/server";
import { getOAuthProvider, OAUTH_PROVIDER_NAMES, type OAuthProviderName } from "@/lib/oauth";
import { isSafeRedirectPath, OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS, parseOAuthState } from "@/lib/oauth/state";
import { CUSTOMER_SESSION_COOKIE, signCustomerSession } from "@/lib/customer-auth";
import { findOrCreateCustomerForOAuth } from "@/services/customers";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function isKnownProvider(value: string): value is OAuthProviderName {
  return (OAUTH_PROVIDER_NAMES as string[]).includes(value);
}

/** The state cookie is single-use — cleared on every exit path, success or failure. */
function clearStateCookie(response: NextResponse): NextResponse {
  response.cookies.set(OAUTH_STATE_COOKIE, "", { ...OAUTH_STATE_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}

async function handleCallback(request: NextRequest, provider: string, rawParams: Record<string, string>): Promise<NextResponse> {
  const failureRedirect = () => clearStateCookie(NextResponse.redirect(new URL("/account/login?error=oauth", request.url)));

  if (!isKnownProvider(provider)) return failureRedirect();

  const ip = getClientIp(request.headers);
  const key = `oauth-callback:ip:${ip}`;
  const limited = await isRateLimited({ key, limit: 30, windowMs: 15 * 60 * 1000 });
  if (limited.limited) return failureRedirect();
  await recordAttempt(key);

  const client = getOAuthProvider(provider);
  if (!client) return failureRedirect();

  const statePayload = parseOAuthState(request.cookies.get(OAUTH_STATE_COOKIE)?.value);
  const code = rawParams.code;
  const returnedState = rawParams.state;
  if (!code || !statePayload || returnedState !== statePayload.state) return failureRedirect();

  const from = isSafeRedirectPath(statePayload.from) ? statePayload.from : "/account";
  const redirectUri = new URL(`/api/auth/oauth/${provider}/callback`, request.url).toString();

  try {
    const profile = await client.exchangeCode({ code, redirectUri, rawParams });
    const customer = await findOrCreateCustomerForOAuth({
      provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
    });

    const token = await signCustomerSession({
      sub: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
    });

    const response = clearStateCookie(NextResponse.redirect(new URL(from, request.url)));
    response.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    console.error(`[oauth] ${provider} callback failed`, error);
    return failureRedirect();
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  return handleCallback(request, provider, rawParams);
}

/** Apple only: response_mode=form_post means the callback arrives as a POST with a form-encoded body, not a GET with a query string. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const form = await request.formData();
  const rawParams: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") rawParams[key] = value;
  }
  return handleCallback(request, provider, rawParams);
}
