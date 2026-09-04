import fs from "node:fs";
import pg from "pg";

/** Waits past the 03:30 UTC cron slot, then measures whether retention actually ran. */
const target = new Date();
target.setUTCHours(3, 40, 0, 0);
if (target.getTime() <= Date.now()) target.setUTCDate(target.getUTCDate() + 1);
const waitMs = target.getTime() - Date.now();
console.log(`waiting ${Math.round(waitMs / 60000)} min, until ${target.toISOString()}`);
await new Promise((r) => setTimeout(r, waitMs));

const env = fs.readFileSync(".env", "utf8");
const url = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="))?.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
const c = new pg.Client({ connectionString: url });
await c.connect();
const stale = await c.query(`SELECT COUNT(*)::int AS n FROM rate_limit_attempts WHERE "createdAt" < now() - interval '2 days'`);
const total = await c.query(`SELECT COUNT(*)::int AS n FROM rate_limit_attempts`);
console.log("OPS-001 RESULT");
console.log("stale rows:", stale.rows[0].n, "(0 means the cron ran)");
console.log("total rows:", total.rows[0].n);
console.log(stale.rows[0].n === 0 ? "VERDICT: cron RAN — OPS-001 can close" : "VERDICT: cron did NOT run — check CRON_SECRET in Vercel");
await c.end();
