import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { commerceErrorResponse, invalidInputResponse, rateLimitedResponse } from "@/lib/commerce/http-errors";
import { CommerceError } from "@/lib/commerce/types";
import { PaymentError } from "@/lib/payments/types";

async function read(response: Response) {
  return { status: response.status, body: (await response.json()) as { error: { code: string; message: string } } };
}

beforeEach(() => {
  // These paths log deliberately; silencing keeps the run readable without hiding failures.
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("commerceErrorResponse", () => {
  it("passes a CommerceError's code and message through as a 400", () => {
    return read(commerceErrorResponse(new CommerceError("OUT_OF_STOCK", "Sold out."))).then(({ status, body }) => {
      expect(status).toBe(400);
      expect(body.error).toEqual({ code: "OUT_OF_STOCK", message: "Sold out." });
    });
  });

  it("sends a PaymentError's public message, never its internal one", async () => {
    const error = new PaymentError("PROVIDER_ERROR", "Stripe key sk_live_... rejected", "Payment could not be started.");
    const { body } = await read(commerceErrorResponse(error));
    expect(body.error.message).toBe("Payment could not be started.");
    expect(JSON.stringify(body)).not.toContain("sk_live");
  });

  it("maps an Unauthorized throw to 401", async () => {
    const { status, body } = await read(commerceErrorResponse(new Error("Unauthorized")));
    expect(status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  /**
   * The regression: this branch used to echo `error.message`, and it matches on text.
   * Prisma's P2025 ("...records that were required but not found") matches it, so a failed
   * update answered with Prisma's own wording naming the operation.
   */
  it("returns 404 without quoting the underlying message", async () => {
    const prismaish = new Error(
      "Invalid `prisma.customerAddress.update()` invocation: An operation failed because it depends on one or more records that were required but not found."
    );
    const { status, body } = await read(commerceErrorResponse(prismaish));
    expect(status).toBe(404);
    expect(body.error.message).toBe("Not found.");
    expect(JSON.stringify(body)).not.toContain("prisma.");
  });

  it("does not leak an unrecognised error's message", async () => {
    const { status, body } = await read(commerceErrorResponse(new Error("connect ECONNREFUSED 10.0.0.5:5432")));
    expect(status).toBe(500);
    expect(body.error.message).toBe("Something went wrong.");
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});

describe("rateLimitedResponse", () => {
  it("is a 429 carrying Retry-After, so a client can back off correctly", async () => {
    const response = rateLimitedResponse(90);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("90");
  });
});

describe("invalidInputResponse", () => {
  it("is a 400 with the caller's own message, which is written for the shopper", async () => {
    const { status, body } = await read(invalidInputResponse("A gift card code is required."));
    expect(status).toBe(400);
    expect(body.error).toEqual({ code: "INVALID_INPUT", message: "A gift card code is required." });
  });
});
