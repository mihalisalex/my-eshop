-- Admin audit log (OBS-002).
--
-- Additive only: one new table, no foreign keys, nothing existing altered.
--
-- No FK to admin_users on purpose. An audit trail that cascades away when the account is
-- deleted is worse than none: the most interesting record is an admin who no longer works
-- here, and a cascade would erase it at exactly the moment it starts to matter. The actor's
-- email is denormalised for the same reason.

CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Newest-first overall, per actor, and per target ("everything that happened to this order").
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");
CREATE INDEX "admin_audit_logs_actorId_createdAt_idx" ON "admin_audit_logs"("actorId", "createdAt");
CREATE INDEX "admin_audit_logs_targetType_targetId_createdAt_idx" ON "admin_audit_logs"("targetType", "targetId", "createdAt");
