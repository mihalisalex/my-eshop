import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PaymentSecretError, decryptSecret, encryptSecret, isSecretStorageConfigured, maskSecret, safeCompare } from "./crypto";

const ORIGINAL = process.env.PAYMENTS_CONFIG_SECRET;

beforeEach(() => {
  process.env.PAYMENTS_CONFIG_SECRET = "test-secret-that-is-long-enough";
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PAYMENTS_CONFIG_SECRET;
  else process.env.PAYMENTS_CONFIG_SECRET = ORIGINAL;
});

describe("payment secret storage", () => {
  it("round-trips a secret", () => {
    const secret = "sk_live_abcdefghijklmnop";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("produces a different ciphertext each time, so identical keys aren't recognisable in the database", () => {
    const a = encryptSecret("sk_live_same");
    const b = encryptSecret("sk_live_same");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("fails loudly on a tampered ciphertext rather than returning garbage", () => {
    // The reason for GCM: a corrupted credential must not be silently sent to a
    // payment API as if it were real.
    const stored = encryptSecret("sk_live_abc");
    const [version, iv, tag] = stored.split(".");
    const tampered = [version, iv, tag, Buffer.from("not-the-real-data").toString("base64")].join(".");
    expect(() => decryptSecret(tampered)).toThrow(PaymentSecretError);
  });

  it("explains a rotated master secret instead of surfacing a crypto error", () => {
    const stored = encryptSecret("sk_live_abc");
    process.env.PAYMENTS_CONFIG_SECRET = "a-completely-different-secret";
    expect(() => decryptSecret(stored)).toThrow(/PAYMENTS_CONFIG_SECRET changed/);
  });

  it("refuses to encrypt at all without a master secret, rather than falling back to a default", () => {
    // A hardcoded fallback would make every deployment's secrets decryptable from source.
    delete process.env.PAYMENTS_CONFIG_SECRET;
    expect(isSecretStorageConfigured()).toBe(false);
    expect(() => encryptSecret("anything")).toThrow(PaymentSecretError);

    process.env.PAYMENTS_CONFIG_SECRET = "tooshort";
    expect(isSecretStorageConfigured()).toBe(false);
    expect(() => encryptSecret("anything")).toThrow(PaymentSecretError);
  });

  it("rejects a malformed stored value", () => {
    expect(() => decryptSecret("not-encrypted-at-all")).toThrow(/malformed/i);
    expect(() => decryptSecret("v2.a.b.c")).toThrow(/malformed|incompatible/i);
  });
});

describe("maskSecret", () => {
  it("reveals only the last four characters", () => {
    const masked = maskSecret("sk_live_abcdefgh1234");
    expect(masked.endsWith("1234")).toBe(true);
    expect(masked).not.toContain("abcdefgh");
  });

  it("handles an empty value", () => {
    expect(maskSecret("")).toBe("");
  });
});

describe("safeCompare", () => {
  it("compares equal strings as equal and different ones as different", () => {
    expect(safeCompare("abc123", "abc123")).toBe(true);
    expect(safeCompare("abc123", "abc124")).toBe(false);
  });

  it("returns false for a length mismatch instead of throwing", () => {
    expect(safeCompare("abc", "abcdef")).toBe(false);
    expect(safeCompare("", "abc")).toBe(false);
  });
});
