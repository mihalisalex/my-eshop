import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAdminSession } from "@/lib/admin-session";
import { resolvePage, toPaged, type Paged } from "@/lib/pagination";

/**
 * Writing and reading the admin audit trail (OBS-002).
 *
 * The actions worth recording are the ones that move money, change who can do what, or
 * alter an order after a customer has paid for it. Everything else is noise that would
 * bury them.
 */

/**
 * Dotted verbs, so a filter on "payment." finds every money-moving action at once.
 *
 * OBS-003 widened this from two surfaces to eight. What earns a place is deliberate, not
 * "every mutation": an action is recorded when it moves money, changes who can do what,
 * alters an order after a customer has paid, or **destroys something that cannot be
 * reconstructed from the row that remains**.
 *
 * That last clause is what decides the near misses. A review being approved or rejected is
 * not here, because the review row carries its own status and the change is legible from the
 * data itself; a review being *deleted* is, because nothing is left to read. By the same
 * logic `product.created` is absent — a product that exists is its own evidence — while
 * `product.updated` is present, since an overwritten price leaves no trace of what it was.
 */
export type AuditAction =
  | "payment.refunded"
  | "payment.confirmed_manually"
  | "payment.cancelled"
  | "order.status_changed"
  | "order.tracking_updated"
  | "order.shipment_created"
  | "adminUser.created"
  | "adminUser.role_changed"
  | "adminUser.deleted"
  | "review.deleted"
  | "giftCard.created"
  | "giftCard.updated"
  | "giftCard.deleted"
  | "discount.created"
  | "discount.updated"
  | "discount.deleted"
  | "return.status_changed"
  | "settings.updated"
  | "product.updated"
  | "product.deleted"
  | "product.bulk_updated";

export interface AuditEntryInput {
  action: AuditAction;
  targetType:
    | "payment"
    | "order"
    | "adminUser"
    | "review"
    | "giftCard"
    | "discount"
    | "return"
    | "settings"
    | "product";
  targetId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records one admin action. Resolves the actor from the session itself rather than taking
 * it as an argument — an audit trail whose caller supplies its own identity records
 * whatever the caller says, which is not evidence of anything.
 *
 * Never throws. A failed audit write must not roll back the refund that succeeded: losing
 * the record of a completed action is bad, but failing an action that already moved money
 * because its bookkeeping failed is worse. The failure is logged loudly instead.
 */
export async function recordAdminAction(entry: AuditEntryInput): Promise<void> {
  try {
    const session = await getAdminSession();
    await prisma.adminAuditLog.create({
      data: {
        actorId: session?.sub ?? "unknown",
        // Denormalised so the entry survives the account being deleted.
        actorEmail: session?.email ?? "unknown",
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        summary: entry.summary,
        metadata: entry.metadata ? (entry.metadata as object) : undefined,
      },
    });
  } catch (error) {
    logger.error("Failed to write an admin audit entry", error, {
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
    });
  }
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: string;
}

/** Newest first — the admin reads this to answer "what just happened", not "what happened in 2024". */
export async function listAuditLog(query: { page?: number; pageSize?: number; action?: string } = {}): Promise<Paged<AuditLogEntry>> {
  const pageSize = query.pageSize ?? 25;
  // `startsWith` so "payment" matches every payment.* verb without listing them.
  const where = query.action ? { action: { startsWith: query.action } } : {};

  const total = await prisma.adminAuditLog.count({ where });
  const { page, skip, take } = resolvePage(total, { page: query.page ?? 1, pageSize });
  const rows = await prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take });

  return toPaged(
    rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      actorEmail: row.actorEmail,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      summary: row.summary,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize
  );
}
