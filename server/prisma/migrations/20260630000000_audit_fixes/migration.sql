-- Audit remediation migration
-- Adds role + tokenVersion to User, drops ModelMetrics table + orphaned ModelType enum

ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

DROP TABLE "ModelMetrics";
