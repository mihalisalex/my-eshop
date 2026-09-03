import bcrypt from "bcryptjs";

/**
 * The work factor every password in this app is hashed at. Shared so a future increase
 * moves the dummy hash below with it — a dummy cheaper than the real ones would reopen
 * exactly the timing gap this module exists to close.
 */
export const BCRYPT_ROUNDS = 12;

/**
 * A real bcrypt hash of 32 random bytes nobody kept. Safe in source: it protects nothing
 * and verifies nothing — its only job is to cost the same as a genuine comparison.
 */
const DUMMY_HASH = "$2b$12$1Sw37sH.QspL7vAnnHqFy.w7LU984BhrT.zLduvLYqzhs/In904De";

/**
 * Password check that takes the same time whether or not the account exists (AUTH-002).
 *
 * Both sign-in paths used to read `user ? await bcrypt.compare(...) : false`, which skips
 * ~100ms of hashing entirely when the account is absent. That difference is measurable from
 * outside and turns the login form into a reliable account-enumeration oracle — a rate
 * limiter bounds how fast an attacker can ask, but every answer they do get is still true.
 *
 * Comparing against a throwaway hash on the miss path makes both branches cost the same.
 * The result is discarded; `false` is returned regardless.
 *
 * Also covers a customer row with NO password at all — an OAuth-only account — which is a
 * miss for the same reason and must not be a fast one either.
 */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(password, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(password, hash);
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
