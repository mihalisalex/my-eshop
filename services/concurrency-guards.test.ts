import { describe, expect, it, afterAll } from "vitest";
import crypto from "node:crypto";
import pg from "pg";

/**
 * TEST-001. The oversell and gift-card guards in services/checkout.ts are the most
 * valuable engineering in this repo and had no test at all — a refactor back to
 * read-check-write would have passed CI in silence and started overselling.
 *
 * What is asserted here is the DATABASE behaviour those guards are built on: that a
 * conditional `UPDATE … WHERE quantity >= n` serialises concurrent writers and reports,
 * through its affected-row count, which of them actually won. If that ever stops being
 * true, both guards are decoration.
 *
 * It matters that this runs against THIS shop's real Postgres rather than a local one.
 * The app connects through Neon's PgBouncer pooler in transaction mode, and pooling is
 * exactly the layer that could invalidate the assumption — a guard that holds on a direct
 * connection and not through the pooler would be worse than no guard, because it would
 * look correct everywhere it was tested.
 *
 * Every test creates its own randomly-named table and drops it. It never reads or writes
 * a single row of real catalogue, order or payment data, which is what makes it safe to
 * point at any database including production.
 */

const CONNECTION = process.env.DATABASE_URL;
const clients: pg.Client[] = [];

async function connect(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: CONNECTION });
  await client.connect();
  clients.push(client);
  return client;
}

afterAll(async () => {
  await Promise.all(clients.map((client) => client.end().catch(() => {})));
});

describe.skipIf(!CONNECTION)("the conditional-UPDATE guard, against the real pooled database", () => {
  it("lets exactly one of many concurrent buyers take the last unit", async () => {
    const table = `_race_stock_${crypto.randomUUID().replace(/-/g, "")}`;
    const owner = await connect();
    await owner.query(`CREATE TABLE "${table}" (id text primary key, quantity int not null)`);

    try {
      await owner.query(`INSERT INTO "${table}" VALUES ('last-pair', 1)`);

      // Ten separate connections, so this is genuine concurrency rather than ten
      // statements queued on one session.
      const buyers = await Promise.all(Array.from({ length: 10 }, () => connect()));
      const affected = await Promise.all(
        buyers.map((buyer) =>
          buyer
            .query(`UPDATE "${table}" SET quantity = quantity - 1 WHERE id = 'last-pair' AND quantity >= 1`)
            .then((r) => r.rowCount)
        )
      );

      // The affected-row count IS the availability check — this is the whole mechanism.
      expect(affected.filter((count) => count === 1)).toHaveLength(1);
      expect(affected.filter((count) => count === 0)).toHaveLength(9);

      const { rows } = await owner.query(`SELECT quantity FROM "${table}"`);
      expect(rows[0].quantity).toBe(0);
    } finally {
      await owner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
  }, 60_000);

  it("never lets a balance go negative, however many spenders race for it", async () => {
    /**
     * The gift-card case. A card is one code anyone holding it can spend, so this race
     * needs two people with the same card rather than two racing for the last unit —
     * materially easier to hit than the stock one.
     */
    const table = `_race_balance_${crypto.randomUUID().replace(/-/g, "")}`;
    const owner = await connect();
    await owner.query(`CREATE TABLE "${table}" (code text primary key, balance numeric(10,2) not null)`);

    try {
      await owner.query(`INSERT INTO "${table}" VALUES ('GIFT-50', 50.00)`);

      // Eight spenders, each trying to take 30 from a balance of 50: at most one can.
      const spenders = await Promise.all(Array.from({ length: 8 }, () => connect()));
      const affected = await Promise.all(
        spenders.map((spender) =>
          spender
            .query(`UPDATE "${table}" SET balance = balance - 30 WHERE code = 'GIFT-50' AND balance >= 30`)
            .then((r) => r.rowCount)
        )
      );

      expect(affected.filter((count) => count === 1)).toHaveLength(1);

      const { rows } = await owner.query(`SELECT balance FROM "${table}"`);
      expect(Number(rows[0].balance)).toBe(20);
      expect(Number(rows[0].balance)).toBeGreaterThanOrEqual(0);
    } finally {
      await owner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
  }, 60_000);

  it("rejects a duplicate on a unique constraint rather than writing it twice", async () => {
    /**
     * Both the order idempotency guard (`Order.checkoutId` unique) and webhook replay
     * suppression (`@@unique([provider, eventId])`) rest on this: the second writer must
     * fail with 23505 so the caller can recover by returning the winner's row.
     */
    const table = `_race_unique_${crypto.randomUUID().replace(/-/g, "")}`;
    const owner = await connect();
    await owner.query(`CREATE TABLE "${table}" (id serial primary key, checkout_id text not null unique)`);

    try {
      const writers = await Promise.all(Array.from({ length: 6 }, () => connect()));
      const outcomes = await Promise.all(
        writers.map((writer) =>
          writer
            .query(`INSERT INTO "${table}" (checkout_id) VALUES ('chk_same')`)
            .then(() => "written" as const)
            .catch((error: { code?: string }) => (error.code === "23505" ? ("duplicate" as const) : ("other" as const)))
        )
      );

      expect(outcomes.filter((o) => o === "written")).toHaveLength(1);
      expect(outcomes.filter((o) => o === "duplicate")).toHaveLength(5);
      expect(outcomes).not.toContain("other");

      const { rows } = await owner.query(`SELECT count(*)::int AS n FROM "${table}"`);
      expect(rows[0].n).toBe(1);
    } finally {
      await owner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
  }, 60_000);
});

/**
 * BUG-001. Found in production use, not by reading code: the browser showed "Something went
 * wrong" and the server log held a P2002 sandwiched between two successful requests for the
 * same owner id.
 *
 * `getOrCreateWishlistRow` did find-then-create with no recovery, so two requests for the
 * same owner arriving together both found nothing, both INSERTed, and the loser 500'd on the
 * unique constraint. WishlistProvider loads on mount, which makes this an ordinary-use race
 * rather than a load-related one.
 *
 * Unlike the guards above this exercises the real service against the real database, so it
 * creates and removes exactly one row of its own.
 */
describe.skipIf(!CONNECTION)("the wishlist get-or-create race", () => {
  it("serves one wishlist to ten simultaneous first-time loads", async () => {
    const { getWishlistByOwner } = await import("@/services/wishlists");
    const { prisma } = await import("@/lib/prisma");
    const anonymousId = `anon_race_${Date.now()}`;

    try {
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => getWishlistByOwner({ anonymousId }))
      );

      const fulfilled = results.filter((r) => r.status === "fulfilled");

      // Every caller gets a wishlist — the loser of the race recovers by reading the
      // winner's row rather than surfacing a 500.
      expect(fulfilled).toHaveLength(10);
      // And they all get the SAME one; the unique constraint is what guarantees it.
      expect(new Set(fulfilled.map((r) => r.value.id)).size).toBe(1);
    } finally {
      await prisma.wishlist.deleteMany({ where: { anonymousId } });
    }
  }, 60_000);
});
