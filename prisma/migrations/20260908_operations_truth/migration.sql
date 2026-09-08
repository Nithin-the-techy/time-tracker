-- Operations update: category-less logging and one Sprint membership per Outcome.
-- Apply only after exporting a production JSON backup and reviewing duplicate links.
ALTER TABLE "Entry" ALTER COLUMN "subdepartmentId" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "SprintGoal_goalId_key" ON "SprintGoal"("goalId");
