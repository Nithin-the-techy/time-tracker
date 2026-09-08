-- Make blocker removal reversible. Existing blockers remain active.
ALTER TABLE "GoalProblem" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "GoalProblem_archivedAt_idx" ON "GoalProblem"("archivedAt");
