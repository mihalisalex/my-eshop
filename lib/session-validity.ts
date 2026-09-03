/**
 * Whether a session issued at `issuedAt` is still honoured for an account whose sessions
 * were invalidated at `sessionsValidFrom` (AUTH-001).
 *
 * Sessions here are stateless JWTs, so there is nothing to delete server-side when a
 * password changes — an attacker who had signed in kept a working session for the rest of
 * its lifetime (up to seven days for a customer) even after the victim changed the password
 * specifically to lock them out. Recording the moment of invalidation on the account and
 * refusing anything older is what makes a password change mean what people assume it means.
 *
 * A token with NO `iat` is refused once an invalidation exists. Those are sessions issued
 * before this claim was read at all: they cannot be placed in time, and the safe reading of
 * "I cannot tell whether this predates the password change" is to make the person sign in
 * again rather than to let it through.
 *
 * Seconds, not milliseconds — `iat` is a UNIX timestamp in seconds, and comparing it
 * directly against a millisecond `Date` is the kind of unit mismatch that silently never
 * fires and leaves the guard looking present while doing nothing.
 *
 * No `server-only`: this is pure arithmetic with no data access, and keeping it importable
 * from anywhere is what lets it be unit-tested directly.
 */
export function isSessionStillValid(issuedAt: number | undefined, sessionsValidFrom: Date | null): boolean {
  if (!sessionsValidFrom) return true;
  if (typeof issuedAt !== "number") return false;
  return issuedAt >= Math.floor(sessionsValidFrom.getTime() / 1000);
}
