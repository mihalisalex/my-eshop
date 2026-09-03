import { describe, expect, it } from "vitest";
import { isSessionStillValid } from "@/lib/session-validity";

/**
 * AUTH-001. Sessions are stateless JWTs, so a password change could not revoke them —
 * an attacker who had signed in kept a working session for up to seven more days after
 * the victim changed the password specifically to lock them out.
 */
const secondsAt = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe("isSessionStillValid", () => {
  it("honours every session while the account has never been invalidated", () => {
    expect(isSessionStillValid(secondsAt("2020-01-01T00:00:00Z"), null)).toBe(true);
    expect(isSessionStillValid(undefined, null)).toBe(true);
  });

  it("refuses a session issued before the password changed", () => {
    const changedAt = new Date("2026-09-04T12:00:00Z");
    expect(isSessionStillValid(secondsAt("2026-09-04T11:59:59Z"), changedAt)).toBe(false);
  });

  it("keeps the session the password change itself issued", () => {
    // Signing in again immediately after a change must work, including at the same second.
    const changedAt = new Date("2026-09-04T12:00:00Z");
    expect(isSessionStillValid(secondsAt("2026-09-04T12:00:00Z"), changedAt)).toBe(true);
    expect(isSessionStillValid(secondsAt("2026-09-04T12:00:01Z"), changedAt)).toBe(true);
  });

  it("refuses a token carrying no issued-at once an invalidation exists", () => {
    // Issued before the claim was read at all — it cannot be placed in time, and "I cannot
    // tell whether this predates the password change" has to mean sign in again.
    expect(isSessionStillValid(undefined, new Date("2026-09-04T12:00:00Z"))).toBe(false);
  });

  it("compares seconds against milliseconds correctly", () => {
    /**
     * The unit mismatch this guards is the kind that fails silently: `iat` is in seconds
     * and `Date.getTime()` in milliseconds, so a naive comparison makes every token look
     * ~1000x older than the cutoff and the guard rejects everyone — or, flipped, never
     * fires at all. A 2026 token against a 2026 cutoff is the case that catches it.
     */
    const changedAt = new Date("2026-09-04T12:00:00Z");
    expect(isSessionStillValid(secondsAt("2026-09-05T00:00:00Z"), changedAt)).toBe(true);
    expect(isSessionStillValid(secondsAt("2026-09-03T00:00:00Z"), changedAt)).toBe(false);
  });
});
