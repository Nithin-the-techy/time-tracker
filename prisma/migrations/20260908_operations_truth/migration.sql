-- Operations update: category-less logging and one Sprint membership per Outcome.
-- Apply only after exporting a production JSON backup and reviewing duplicate links.
ALTER TABLE "Entry" ALTER COLUMN "subdepartmentId" DROP NOT NULL;
ALTER TABLE "Entry" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "GoalAction" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "GoalAction" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "SprintGoal_goalId_key" ON "SprintGoal"("goalId");
CREATE INDEX IF NOT EXISTS "Entry_deletedAt_idx" ON "Entry"("deletedAt");
CREATE INDEX IF NOT EXISTS "Goal_deletedAt_idx" ON "Goal"("deletedAt");
CREATE INDEX IF NOT EXISTS "GoalAction_deletedAt_idx" ON "GoalAction"("deletedAt");

CREATE TABLE IF NOT EXISTS "WorkspacePreference" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspacePreference_pkey" PRIMARY KEY ("id")
);
