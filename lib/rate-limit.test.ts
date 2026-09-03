import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/rate-limit";

/**
 * Every rate limit in the app keys on this — admin sign-in brute-force protection
 * included — so the header it trusts is a security decision, not a detail.
 */
const headers = (init: Record<string, string>) => new Headers(init);

describe("getClientIp", () => {
  it("prefers the platform's own header over a client-supplied one", () => {
    /**
     * The finding this guards (SEC-004). `x-forwarded-for` is an ordinary request header
     * that anyone can send. Reading it first meant a single attacker could mint a fresh
     * rate-limit bucket per request by varying it, defeating the login limiter.
     */
    const spoofed = headers({
      "x-forwarded-for": "1.2.3.4",
      "x-vercel-forwarded-for": "203.0.113.9",
    });
    expect(getClientIp(spoofed)).toBe("203.0.113.9");
  });

  it("prefers x-real-ip over x-forwarded-for when Vercel's header is absent", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back to x-forwarded-for where no platform header exists", () => {
    // Local dev, or a host that sets nothing — there is no proxy in front to be lied to.
    expect(getClientIp(headers({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("takes the first hop from a comma-separated list", () => {
    expect(getClientIp(headers({ "x-vercel-forwarded-for": "203.0.113.9, 70.41.3.18" }))).toBe("203.0.113.9");
    expect(getClientIp(headers({ "x-forwarded-for": " 203.0.113.9 , 70.41.3.18 " }))).toBe("203.0.113.9");
  });

  it("skips an empty header rather than keying every caller on the empty string", () => {
    // One shared bucket for all traffic would be a self-inflicted denial of service.
    expect(getClientIp(headers({ "x-vercel-forwarded-for": "", "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(getClientIp(headers({ "x-forwarded-for": "  ,  " }))).toBe("unknown");
  });

  it("returns a stable placeholder when nothing identifies the caller", () => {
    expect(getClientIp(headers({}))).toBe("unknown");
  });
});
