import "dotenv/config";
import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    /**
     * `DIRECT_URL` when set, otherwise the normal connection.
     *
     * This file is read ONLY by the Prisma CLI — migrate, db, studio. The running app
     * builds its own client from `process.env.DATABASE_URL` in lib/prisma.ts and never
     * loads this config, so changing it cannot affect the deployed shop.
     *
     * It matters because `DATABASE_URL` points at Neon's `-pooler` endpoint, which is
     * PgBouncer in transaction mode. That is the right choice for the app — it is what
     * keeps a serverless deployment from exhausting Neon's connection limit — but
     * migrations take a session-level advisory lock to stop two deploys applying the same
     * migration at once, and a transaction-mode pooler cannot hold one across statements.
     * `prisma migrate deploy` therefore fails against the pooled URL while ordinary queries
     * through it work perfectly, which is a confusing way to be blocked.
     *
     * `DIRECT_URL` is the same Neon database without `-pooler` in the host. Set it in
     * `.env` locally; it is not needed in production, where nothing runs migrations.
     */
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx scripts/seed.ts",
  },
});
