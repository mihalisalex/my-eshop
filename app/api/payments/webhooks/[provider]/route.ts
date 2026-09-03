import { NextResponse, type NextRequest } from "next/server";
import { handleProviderWebhook } from "@/services/payments";
import { logger } from "@/lib/logger";

/**
 * One endpoint, every provider (§14): `/api/payments/webhooks/:provider`.
 *
 * This handler deliberately contains no provider-specific logic at all — it reads
 * the raw body, hands it to the payment service, and translates the outcome into a
 * status code. Every signature scheme, event vocabulary and payload shape lives in
 * the provider that owns it, so connecting a new bank adds zero lines here.
 *
 * `request.text()` rather than `request.json()` is load-bearing: signature
 * verification must run against the exact bytes the provider signed, and any
 * parse-then-restringify round trip can reorder keys or change escaping enough to
 * invalidate a perfectly good signature.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Could not read the request body." }, { status: 400 });
  }

  try {
    const result = await handleProviderWebhook(provider, rawBody, request.headers);

    // Everything the pipeline handled — including duplicates and events we don't
    // act on — is acknowledged with a 200. Returning an error for those would make
    // the provider retry indefinitely and eventually disable the endpoint, which
    // would then also stop delivering the events we DO care about.
    if (result.status === "unverified") {
      // The one case that must not be acknowledged: an unverifiable signature is
      // either an attack or a real misconfiguration, and both deserve a hard 400.
      // The payload is already stored for inspection.
      return NextResponse.json({ received: true, applied: false, reason: result.message }, { status: 400 });
    }
    return NextResponse.json({ received: true, status: result.status, message: result.message });
  } catch (error) {
    // A genuine server fault (database down, unexpected bug) SHOULD be retried by
    // the provider, so this is the only path that returns a 5xx.
    logger.error("Webhook processing failed", error, { provider });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}

/** A GET is almost always someone checking the endpoint exists — answer plainly rather than 405ing. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return NextResponse.json({ endpoint: `payments webhook for "${provider}"`, method: "POST" });
}
