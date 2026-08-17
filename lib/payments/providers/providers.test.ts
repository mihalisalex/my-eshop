import { describe, expect, it } from "vitest";
import { cashOnDeliveryProvider } from "./cash-on-delivery";
import { bankTransferProvider } from "./bank-transfer";
import { irisProvider } from "./iris";
import { piraeusProvider } from "./piraeus";
import { applePayProvider } from "./apple-pay";
import type { PaymentContext, PaymentRecord, ResolvedProviderConfig } from "@/lib/payments/types";

function config(values: Record<string, string> = {}, secrets: Record<string, string> = {}): ResolvedProviderConfig {
  return { providerId: "test", environment: "production", values, secrets, sourcedFromEnv: new Set() };
}

function payment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: "pay_1",
    orderId: "order_abcdef1234",
    providerId: "test",
    methodId: "test",
    externalPaymentId: null,
    amount: { amount: 120, currencyCode: "EUR" },
    refundedAmount: { amount: 0, currencyCode: "EUR" },
    status: "pending",
    environment: "production",
    idempotencyKey: "pay_key",
    failureReason: null,
    metadata: {},
    createdAt: "2026-08-17T09:00:00.000Z",
    updatedAt: "2026-08-17T09:00:00.000Z",
    paidAt: null,
    failedAt: null,
    cancelledAt: null,
    refundedAt: null,
    ...overrides,
  };
}

function context(cfg: ResolvedProviderConfig, record = payment()): PaymentContext {
  return {
    config: cfg,
    method: cashOnDeliveryProvider.methods[0],
    payment: record,
    idempotencyKey: record.idempotencyKey,
  };
}

describe("Cash on Delivery provider", () => {
  it("creates a pending payment with instructions, never a paid one", () => {
    // The order ships before the money exists; anything but `pending` here would be
    // recording revenue that hasn't happened.
    return cashOnDeliveryProvider.initializePayment(context(config())).then((result) => {
      expect(result.status).toBe("pending");
      expect(result.customerAction?.type).toBe("display_instructions");
      expect(result.customerAction?.instructions?.[0]?.value).toContain("120.00");
    });
  });

  it("settles only through an explicit confirmation", async () => {
    expect((await cashOnDeliveryProvider.confirmPayment(context(config()))).status).toBe("paid");
  });

  it("records a partial cash refund and then completes it", async () => {
    const partial = await cashOnDeliveryProvider.refundPayment({
      ...context(config(), payment({ status: "paid" })),
      amount: { amount: 20, currencyCode: "EUR" },
    });
    expect(partial.status).toBe("partially_refunded");
    expect(partial.refundedAmount?.amount).toBe(20);

    const full = await cashOnDeliveryProvider.refundPayment({
      ...context(config(), payment({ status: "partially_refunded", refundedAmount: { amount: 20, currencyCode: "EUR" } })),
      amount: { amount: 100, currencyCode: "EUR" },
    });
    expect(full.status).toBe("refunded");
    expect(full.refundedAmount?.amount).toBe(120);
  });

  it("refuses to refund more than was collected", async () => {
    await expect(
      cashOnDeliveryProvider.refundPayment({
        ...context(config(), payment({ status: "paid" })),
        amount: { amount: 200, currencyCode: "EUR" },
      })
    ).rejects.toThrow(/exceed/i);
  });

  it("reports itself connected but explicitly not live-checked", async () => {
    const result = await cashOnDeliveryProvider.validateConfiguration(config());
    expect(result.status).toBe("connected");
    // §19: a green state that made no request must say so.
    expect(result.checkedLive).toBe(false);
  });
});

describe("Bank Transfer provider", () => {
  const complete = config({
    bankName: "Test Bank",
    accountHolder: "ALEXANDRIS",
    iban: "GR9600000000000000000000000",
    useOrderNumberAsReference: "true",
  });

  it("is unconfigured until the required bank details are present", () => {
    expect(bankTransferProvider.isConfigured(config())).toBe(false);
    expect(bankTransferProvider.isConfigured(config({ bankName: "Test Bank" }))).toBe(false);
    expect(bankTransferProvider.isConfigured(complete)).toBe(true);
  });

  it("lands in awaiting_bank_transfer, NOT paid, when the order is created", async () => {
    const result = await bankTransferProvider.initializePayment(context(complete));
    expect(result.status).toBe("awaiting_bank_transfer");
  });

  it("shows the customer the bank details and a payment reference", async () => {
    const result = await bankTransferProvider.initializePayment(context(complete));
    const labels = result.customerAction?.instructions?.map((line) => line.label) ?? [];
    expect(labels).toContain("IBAN");
    expect(labels).toContain("Account holder");
    expect(labels).toContain("Payment reference");
    const reference = result.customerAction?.instructions?.find((l) => l.label === "Payment reference");
    // Matches the short order number shown throughout the admin, so a bank statement
    // can be matched to an order by eye.
    expect(reference?.value).toBe("ABCDEF1234".slice(-8));
  });

  it("omits the reference when the store has turned that option off", async () => {
    const withoutReference = config({ ...complete.values, useOrderNumberAsReference: "false" });
    const result = await bankTransferProvider.initializePayment(context(withoutReference));
    expect(result.customerAction?.instructions?.some((l) => l.label === "Payment reference")).toBe(false);
  });

  it("refuses to start a payment when the bank details are incomplete", async () => {
    await expect(bankTransferProvider.initializePayment(context(config()))).rejects.toThrow(/incomplete/i);
  });

  it("reports which required fields are missing rather than a generic failure", async () => {
    const result = await bankTransferProvider.validateConfiguration(config({ bankName: "Test Bank" }));
    expect(result.status).toBe("not_configured");
    expect(result.message).toMatch(/IBAN/);
    expect(result.checkedLive).toBe(false);
  });
});

describe("unconnected integration boundaries", () => {
  for (const provider of [irisProvider, piraeusProvider]) {
    describe(provider.name, () => {
      it("never reports itself connected, however much configuration exists", async () => {
        const result = await provider.validateConfiguration(
          config({ merchantId: "M1", apiBaseUrl: "https://example.test" }, { apiKey: "k", apiSecret: "s" })
        );
        expect(result.status).toBe("not_implemented");
        expect(result.checkedLive).toBe(false);
      });

      it("refuses to create a payment rather than faking one", async () => {
        await expect(provider.initializePayment(context(config()))).rejects.toThrow(/not implemented/i);
      });

      it("refuses to refund rather than silently reporting success", async () => {
        await expect(
          provider.refundPayment({ ...context(config()), amount: { amount: 10, currencyCode: "EUR" } })
        ).rejects.toThrow(/not implemented/i);
      });

      it("returns the stored status instead of throwing, so historical rows stay viewable", async () => {
        const record = payment({ status: "failed" });
        expect((await provider.getPaymentStatus(context(config(), record))).status).toBe("failed");
      });

      it("rejects webhooks it cannot verify", async () => {
        await expect(
          provider.parseWebhook!({ rawBody: "{}", headers: new Headers() }, config())
        ).rejects.toThrow(/cannot be verified/i);
      });
    });
  }
});

describe("Apple Pay provider", () => {
  it("declares Stripe as its processor by default", () => {
    expect(applePayProvider.processingProviderIdFor?.(config())).toBe("stripe");
    expect(applePayProvider.processingProviderIdFor?.(config({ processingProvider: "stripe" }))).toBe("stripe");
  });

  it("rejects a processor that isn't registered", () => {
    expect(applePayProvider.processingProviderIdFor?.(config({ processingProvider: "nonsense" }))).toBeNull();
    expect(applePayProvider.isConfigured(config({ processingProvider: "nonsense" }))).toBe(false);
  });

  it("refuses to operate without its processor's configuration resolved", async () => {
    // Running against Apple Pay's own config would find no API key and blame the
    // wrong provider.
    await expect(applePayProvider.initializePayment(context(config()))).rejects.toThrow(/processing provider/i);
  });

  it("requires an extra device check on top of whatever the server decided", () => {
    expect(applePayProvider.methods[0].clientCapability).toBe("apple-pay");
  });

  it("has no webhook endpoint of its own — its events belong to the processor", () => {
    expect(applePayProvider.webhookSupported).toBe(false);
    expect(applePayProvider.parseWebhook).toBeUndefined();
  });
});
