import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  fromStripeAmount,
  mapStripeStatus,
  normalizeStripeEvent,
  stripeProvider,
  stripeSecretKey,
  stripeWebhookSecret,
  toStripeAmount,
  verifyStripeSignature,
} from "./stripe";
import { PaymentWebhookVerificationError, type ResolvedProviderConfig } from "@/lib/payments/types";

const SIGNING_SECRET = "whsec_test_secret";
const NOW = 1_760_000_000; // Fixed so the tolerance assertions are deterministic.

function config(environment: "sandbox" | "production" = "production"): ResolvedProviderConfig {
  return {
    providerId: "stripe",
    environment,
    values: {},
    secrets:
      environment === "production"
        ? { liveSecretKey: "sk_live_x", liveWebhookSecret: SIGNING_SECRET }
        : { testSecretKey: "sk_test_x", testWebhookSecret: SIGNING_SECRET },
    sourcedFromEnv: new Set(),
  };
}

function sign(body: string, timestamp = NOW, secret = SIGNING_SECRET): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("Stripe amount conversion", () => {
  it("converts to and from minor units without floating-point drift", () => {
    expect(toStripeAmount(19.99, "EUR")).toBe(1999);
    expect(toStripeAmount(0.1 + 0.2, "EUR")).toBe(30); // 0.30000000000000004
    expect(fromStripeAmount(1999, "EUR")).toBe(19.99);
  });

  it("leaves zero-decimal currencies alone", () => {
    expect(toStripeAmount(1999, "JPY")).toBe(1999);
    expect(fromStripeAmount(1999, "JPY")).toBe(1999);
  });
});

describe("mapStripeStatus", () => {
  it("distinguishes a fresh intent from a declined one", () => {
    // `requires_payment_method` is both the initial state and the post-decline state;
    // only last_payment_error separates them.
    expect(mapStripeStatus({ status: "requires_payment_method" })).toBe("pending");
    expect(mapStripeStatus({ status: "requires_payment_method", last_payment_error: { message: "declined" } })).toBe("failed");
  });

  it("never reports an uncaptured authorisation as paid", () => {
    expect(mapStripeStatus({ status: "requires_capture" })).toBe("processing");
    expect(mapStripeStatus({ status: "processing" })).toBe("processing");
  });

  it("maps the terminal states", () => {
    expect(mapStripeStatus({ status: "succeeded" })).toBe("paid");
    expect(mapStripeStatus({ status: "canceled" })).toBe("cancelled");
    expect(mapStripeStatus({ status: "requires_action" })).toBe("awaiting_customer_action");
  });
});

describe("verifyStripeSignature", () => {
  const body = '{"id":"evt_1","type":"payment_intent.succeeded"}';

  it("accepts a correctly signed payload", () => {
    expect(() => verifyStripeSignature(body, sign(body), SIGNING_SECRET, 300, NOW)).not.toThrow();
  });

  it("rejects a payload signed with the wrong secret", () => {
    expect(() => verifyStripeSignature(body, sign(body, NOW, "whsec_wrong"), SIGNING_SECRET, 300, NOW)).toThrow(
      PaymentWebhookVerificationError
    );
  });

  it("rejects a tampered body carrying a valid signature for the original", () => {
    const header = sign(body);
    const tampered = body.replace("succeeded", "payment_failed");
    expect(() => verifyStripeSignature(tampered, header, SIGNING_SECRET, 300, NOW)).toThrow(
      PaymentWebhookVerificationError
    );
  });

  it("rejects a replayed signature from outside the tolerance window", () => {
    // Without this, any signature ever observed stays valid forever.
    const old = sign(body, NOW - 3600);
    expect(() => verifyStripeSignature(body, old, SIGNING_SECRET, 300, NOW)).toThrow(/tolerance/);
  });

  it("rejects a missing or malformed header rather than passing it through", () => {
    expect(() => verifyStripeSignature(body, null, SIGNING_SECRET, 300, NOW)).toThrow(/Missing/);
    expect(() => verifyStripeSignature(body, "garbage", SIGNING_SECRET, 300, NOW)).toThrow(/Malformed/);
  });

  it("accepts a header carrying several v1 signatures, as Stripe sends during secret rotation", () => {
    const valid = sign(body).split(",")[1];
    const header = `t=${NOW},v1=deadbeef,${valid}`;
    expect(() => verifyStripeSignature(body, header, SIGNING_SECRET, 300, NOW)).not.toThrow();
  });
});

describe("normalizeStripeEvent", () => {
  const cfg = config();

  it("carries our own payment id through from metadata", () => {
    const event = normalizeStripeEvent(
      {
        id: "evt_1",
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_1", metadata: { paymentId: "pay_123" } } },
      },
      cfg
    );
    expect(event.paymentId).toBe("pay_123");
    expect(event.externalPaymentId).toBe("pi_1");
    expect(event.status).toBe("paid");
  });

  it("does NOT treat a completed checkout session as paid unless it says it is paid", () => {
    // For delayed payment methods the session completes long before the money moves.
    const unpaid = normalizeStripeEvent(
      { id: "evt_2", type: "checkout.session.completed", data: { object: { payment_intent: "pi_2", payment_status: "unpaid" } } },
      cfg
    );
    expect(unpaid.status).toBe("processing");

    const paid = normalizeStripeEvent(
      { id: "evt_3", type: "checkout.session.completed", data: { object: { payment_intent: "pi_3", payment_status: "paid" } } },
      cfg
    );
    expect(paid.status).toBe("paid");
  });

  it("distinguishes a partial refund from a full one", () => {
    const partial = normalizeStripeEvent(
      {
        id: "evt_4",
        type: "charge.refunded",
        data: { object: { payment_intent: "pi_4", currency: "eur", amount_captured: 10000, amount_refunded: 2500 } },
      },
      cfg
    );
    expect(partial.status).toBe("partially_refunded");
    expect(partial.refundedAmount).toEqual({ amount: 25, currencyCode: "EUR" });

    const full = normalizeStripeEvent(
      {
        id: "evt_5",
        type: "charge.refunded",
        data: { object: { payment_intent: "pi_5", currency: "eur", amount_captured: 10000, amount_refunded: 10000 } },
      },
      cfg
    );
    expect(full.status).toBe("refunded");
  });

  it("ignores event types it doesn't act on instead of erroring", () => {
    // Stripe sends dozens by default; erroring would make it retry forever and
    // eventually disable the endpoint.
    const event = normalizeStripeEvent({ id: "evt_6", type: "customer.created", data: { object: {} } }, cfg);
    expect(event.ignored).toBe(true);
    expect(event.status).toBeNull();
  });

  it("carries the failure reason on a declined payment", () => {
    const event = normalizeStripeEvent(
      {
        id: "evt_7",
        type: "payment_intent.payment_failed",
        data: { object: { id: "pi_7", last_payment_error: { message: "Your card was declined." } } },
      },
      cfg
    );
    expect(event.status).toBe("failed");
    expect(event.failureReason).toBe("Your card was declined.");
  });
});

describe("Stripe configuration", () => {
  it("selects the credentials for the active environment", () => {
    expect(stripeSecretKey(config("production"))).toBe("sk_live_x");
    expect(stripeSecretKey(config("sandbox"))).toBe("sk_test_x");
    expect(stripeWebhookSecret(config("sandbox"))).toBe(SIGNING_SECRET);
  });

  it("is unconfigured when the active environment has no secret key", () => {
    const empty: ResolvedProviderConfig = { ...config("production"), secrets: {} };
    expect(stripeProvider.isConfigured(empty)).toBe(false);
    expect(stripeProvider.isConfigured(config("production"))).toBe(true);
  });

  it("reports a missing key without making a network request", async () => {
    const result = await stripeProvider.validateConfiguration({ ...config("production"), secrets: {} });
    expect(result.status).toBe("not_configured");
    expect(result.checkedLive).toBe(false);
  });

  it("catches a live key pasted into sandbox mode before it can charge anyone", async () => {
    const mismatched: ResolvedProviderConfig = {
      ...config("sandbox"),
      secrets: { testSecretKey: "sk_live_oops" },
    };
    const result = await stripeProvider.validateConfiguration(mismatched);
    expect(result.status).toBe("auth_failed");
    expect(result.checkedLive).toBe(false);
    expect(result.message).toMatch(/sk_test_/);
  });

  it("rejects a webhook when no signing secret has been configured", async () => {
    await expect(
      stripeProvider.parseWebhook!({ rawBody: "{}", headers: new Headers() }, { ...config(), secrets: { liveSecretKey: "sk_live_x" } })
    ).rejects.toThrow(PaymentWebhookVerificationError);
  });
});
