-- Allow an Outcome to belong to one or two Areas while keeping Goal.departmentId
-- as the primary compatibility field for existing logs and exports.
CREATE TABLE IF NOT EXISTS "GoalDepartment" (
    "goalId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GoalDepartment_pkey" PRIMARY KEY ("goalId", "departmentId"),
    CONSTRAINT "GoalDepartment_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GoalDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "GoalDepartment_departmentId_idx" ON "GoalDepartment"("departmentId");

-- Backfill every existing Outcome into the new authoritative membership table.
INSERT INTO "GoalDepartment" ("goalId", "departmentId", "sortOrder")
SELECT g."id", g."departmentId", 0
FROM "Goal" g
WHERE NOT EXISTS (
  SELECT 1 FROM "GoalDepartment" gd
  WHERE gd."goalId" = g."id" AND gd."departmentId" = g."departmentId"
);
