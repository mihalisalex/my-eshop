import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Encryption at rest for payment provider secrets.
 *
 * The alternative — storing API secrets in a plain JSON column — means a single
 * read-only database leak (a snapshot, a misconfigured backup, an over-broad
 * analytics grant) hands out live payment credentials. Encrypting them narrows
 * that to "database AND application secret", which are held in different places.
 *
 * AES-256-GCM specifically, because it authenticates as well as encrypts: a
 * tampered ciphertext fails to decrypt rather than silently yielding garbage
 * that gets sent to a payment API as if it were a credential.
 */

const FORMAT_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, the GCM standard.

export class PaymentSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentSecretError";
  }
}

/**
 * Derived from PAYMENTS_CONFIG_SECRET. Falling back to a hardcoded default here
 * would be worse than useless — it would make every deployment's "encrypted"
 * secrets decryptable by anyone with the source — so a missing variable is a
 * hard error at the point of use rather than a silent downgrade.
 *
 * Not cached in a module-level constant: reading it per call keeps the failure
 * local to the operation that needs it, so a store with no external providers
 * configured never trips over a variable it doesn't need.
 */
function getKey(): Buffer {
  const secret = process.env.PAYMENTS_CONFIG_SECRET;
  if (!secret || secret.length < 16) {
    throw new PaymentSecretError(
      "PAYMENTS_CONFIG_SECRET is not set (or is too short). It is required to store payment provider credentials — generate one with: openssl rand -base64 32"
    );
  }
  // SHA-256 of the passphrase gives the exactly-32-byte key AES-256 needs from an
  // arbitrary-length input. Not a password hash — this is a machine secret with
  // full entropy, not a user password, so a KDF's work factor buys nothing here.
  return createHash("sha256").update(secret).digest();
}

/** True when secret storage is usable. Lets the admin UI explain the gap instead of throwing. */
export function isSecretStorageConfigured(): boolean {
  const secret = process.env.PAYMENTS_CONFIG_SECRET;
  return Boolean(secret && secret.length >= 16);
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [FORMAT_VERSION, iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new PaymentSecretError("Stored payment secret is malformed or was written by an incompatible version.");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  try {
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    // Authentication failure. Almost always a rotated PAYMENTS_CONFIG_SECRET;
    // the message says so, because the fix (re-enter the credentials) is not
    // obvious from "unsupported state or unable to authenticate data".
    throw new PaymentSecretError(
      "Could not decrypt a stored payment secret. This usually means PAYMENTS_CONFIG_SECRET changed — re-enter the provider's credentials to store them under the new key."
    );
  }
}

/**
 * What the admin sees instead of a secret. Shows only the last 4 characters, which
 * is enough to tell two keys apart (and matches how Stripe's own dashboard displays
 * a key) without being enough to use one.
 */
export function maskSecret(plaintext: string): string {
  if (!plaintext) return "";
  const visible = plaintext.slice(-4);
  return `${"•".repeat(Math.min(Math.max(plaintext.length - 4, 4), 24))}${visible}`;
}

/**
 * Constant-time string comparison for webhook signatures. `===` leaks how many
 * leading bytes matched through its timing, which is enough to forge a signature
 * byte by byte given enough attempts.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  // timingSafeEqual throws on a length mismatch, which would itself be a timing
  // signal — but signature lengths are fixed per algorithm, so an unequal length
  // is a malformed input, not a near-miss guess.
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
