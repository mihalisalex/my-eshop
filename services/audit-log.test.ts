import { describe, expect, it, afterAll } from "vitest";
import crypto from "node:crypto";
import pg from "pg";

/**
 * OBS-003. The audit vocabulary grew from 7 verbs to 21 with no migration, on the assumption
 * that `action` and `targetType` are plain text columns rather than Postgres enums.
 *
 * That assumption is worth a test rather than a glance, because of how it would fail. A new
 * value against an enum column raises `22P02`, `recordAdminAction` catches everything and
 * never rethrows — deliberately, so a failed audit write cannot roll back the refund it was
 * recording — and the result would be a shop that looks fully audited and silently records
 * nothing. That is the same shape as the Sentry DSN typo and the reason OPS-001 exists.
 *
 * Runs against the real database and cleans up after itself: every row it writes carries a
 * randomly-generated actor id and is deleted in `afterAll`. It touches no existing row.
 */

const CONNECTION = process.env.DATABASE_URL;
const TEST_ACTOR = `test-actor-${crypto.randomUUID()}`;
let client: pg.Client | null = null;

async function db(): Promise<pg.Client> {
  if (!client) {
    client = new pg.Client({ connectionString: CONNECTION });
    await client.connect();
  }
  return client;
}

afterAll(async () => {
  if (!client) return;
  await client.query(`DELETE FROM admin_audit_logs WHERE "actorId" = $1`, [TEST_ACTOR]);
  await client.end();
  client = null;
});

/**
 * Every verb the service can emit. Kept as a literal list rather than imported, so that
 * adding a verb to the union without considering whether it can actually be stored fails
 * here instead of in production.
 */
const EVERY_ACTION = [
  "payment.refunded",
  "payment.confirmed_manually",
  "payment.cancelled",
  "order.status_changed",
  "order.tracking_updated",
  "order.shipment_created",
  "adminUser.created",
  "adminUser.role_changed",
  "adminUser.deleted",
  "review.deleted",
  "giftCard.created",
  "giftCard.updated",
  "giftCard.deleted",
  "discount.created",
  "discount.updated",
  "discount.deleted",
  "return.status_changed",
  "settings.updated",
  "product.updated",
  "product.deleted",
  "product.bulk_updated",
] as const;

describe.skipIf(!CONNECTION)("the admin audit log, against the real database", () => {
  it("stores every action verb, so widening the vocabulary needs no migration", async () => {
    const c = await db();

    for (const action of EVERY_ACTION) {
      await c.query(
        `INSERT INTO admin_audit_logs (id, "actorId", "actorEmail", action, "targetType", "targetId", summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [crypto.randomUUID(), TEST_ACTOR, "test@example.test", action, action.split(".")[0], "t", "test"]
      );
    }

    const { rows } = await c.query(
      `SELECT COUNT(DISTINCT action)::int AS n FROM admin_audit_logs WHERE "actorId" = $1`,
      [TEST_ACTOR]
    );
    expect(rows[0].n).toBe(EVERY_ACTION.length);
  }, 60_000);

  it("keeps the prefix filter working across the widened vocabulary", async () => {
    // The /admin/activity filter is a `startsWith` on the dotted verb. A verb whose prefix
    // no filter option matches is recorded and then unreachable, which is worse than useless.
    const c = await db();
    const prefixes = ["payment", "order", "adminUser", "review", "giftCard", "discount", "return", "settings", "product"];

    for (const prefix of prefixes) {
      const { rows } = await c.query(
        `SELECT COUNT(*)::int AS n FROM admin_audit_logs WHERE "actorId" = $1 AND action LIKE $2`,
        [TEST_ACTOR, `${prefix}.%`]
      );
      expect(rows[0].n, `no verb starts with "${prefix}."`).toBeGreaterThan(0);
    }
  }, 60_000);

  it("accepts a null metadata, which most call sites pass", async () => {
    const c = await db();
    const id = crypto.randomUUID();
    await c.query(
      `INSERT INTO admin_audit_logs (id, "actorId", "actorEmail", action, "targetType", "targetId", summary, metadata)
       VALUES ($1, $2, $3, 'settings.updated', 'settings', 'site', 'Updated the site settings', NULL)`,
      [id, TEST_ACTOR, "test@example.test"]
    );

    const { rows } = await c.query(`SELECT metadata FROM admin_audit_logs WHERE id = $1`, [id]);
    expect(rows[0].metadata).toBeNull();
  }, 60_000);
});
