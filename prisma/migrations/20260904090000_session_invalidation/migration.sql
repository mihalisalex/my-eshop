-- Session invalidation on password change (AUTH-001).
--
-- Additive only: two nullable columns, no defaults, no backfill, nothing rewritten.
-- NULL means "never invalidated", which is the correct state for every existing row —
-- nobody's current session should be cut off by deploying this.

ALTER TABLE "admin_users" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);
