import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_BYTES = 32;
const EXPIRES_IN_MINUTES = 30;

/**
 * Only the hash is ever persisted — same principle as password hashing: a DB read
 * (or leak) shouldn't hand out a usable credential. A reset token is high-entropy
 * and single-use, unlike a password, so a fast hash (not bcrypt) is appropriate
 * here — nothing meaningful to gain by slowing down an attacker who'd need the
 * raw 256-bit token in hand already for a hash comparison to matter at all.
 */
function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function createPasswordResetToken(customerId: string): Promise<{ rawToken: string; expiresInMinutes: number }> {
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRES_IN_MINUTES * 60 * 1000);
  await prisma.passwordResetToken.create({ data: { customerId, tokenHash: hashToken(rawToken), expiresAt } });
  return { rawToken, expiresInMinutes: EXPIRES_IN_MINUTES };
}

/** Returns the customer id on success, or null for an invalid/expired/already-used token — caller decides how to respond, this never throws for a bad token. */
export async function consumePasswordResetToken(rawToken: string, newPasswordHash: string): Promise<string | null> {
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;

  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.customer.update({ where: { id: row.customerId }, data: { passwordHash: newPasswordHash } }),
  ]);
  return row.customerId;
}
