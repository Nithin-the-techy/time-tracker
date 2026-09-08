-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "subType" TEXT NOT NULL DEFAULT 'freeform',
    "moduleKey" TEXT NOT NULL DEFAULT 'generic',

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subdepartment" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "valueWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "Subdepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "subdepartmentId" TEXT,
    "entryTimestamp" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "note" TEXT,
    "obsidianRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "whyNow" TEXT,
    "constraints" TEXT,
    "moduleKey" TEXT NOT NULL DEFAULT 'generic',
    "status" TEXT NOT NULL DEFAULT 'active',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "startDate" TEXT NOT NULL,
    "targetDate" TEXT NOT NULL,
    "reviewCadence" TEXT NOT NULL DEFAULT 'weekly',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintGoal" (
    "sprintId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintGoal_pkey" PRIMARY KEY ("sprintId","goalId")
);

-- CreateTable
CREATE TABLE "GoalTarget" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "subdepartmentId" TEXT,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'percent',
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "progressSource" TEXT NOT NULL DEFAULT 'manual',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GoalTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalProblem" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "targetId" TEXT,
    "statement" TEXT NOT NULL,
    "evidence" TEXT,
    "severity" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalAction" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "targetId" TEXT,
    "problemId" TEXT,
    "subdepartmentId" TEXT,
    "title" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT 'deep',
    "plannedMinutes" INTEGER NOT NULL DEFAULT 25,
    "dueDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'backlog',
    "todayOrder" INTEGER,
    "definitionOfDone" TEXT,
    "output" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GoalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusSession" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "entryId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "actualMinutes" INTEGER,
    "output" TEXT,
    "friction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspacePreference" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspacePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "whatMattered" TEXT,
    "bottleneck" TEXT,
    "nextChange" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightChange" (
    "id" TEXT NOT NULL,
    "subdepartmentId" TEXT NOT NULL,
    "oldWeight" DOUBLE PRECISION NOT NULL,
    "newWeight" DOUBLE PRECISION NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rival" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionLabel" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Rival_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RivalSectorEstimate" (
    "id" TEXT NOT NULL,
    "rivalId" TEXT NOT NULL,
    "subdepartmentId" TEXT NOT NULL,
    "estimatedWeeklyMinutes" INTEGER NOT NULL,

    CONSTRAINT "RivalSectorEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnclaimedBlock" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnclaimedBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeutralEntry" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NeutralEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayAllowance" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sleepMinutes" INTEGER,
    "neutralMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_slug_key" ON "Department"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Subdepartment_departmentId_name_key" ON "Subdepartment"("departmentId", "name");

-- CreateIndex
CREATE INDEX "Entry_entryTimestamp_idx" ON "Entry"("entryTimestamp");

-- CreateIndex
CREATE INDEX "Entry_departmentId_idx" ON "Entry"("departmentId");

-- CreateIndex
CREATE INDEX "Entry_deletedAt_idx" ON "Entry"("deletedAt");

-- CreateIndex
CREATE INDEX "Goal_status_priority_idx" ON "Goal"("status", "priority");

-- CreateIndex
CREATE INDEX "Goal_departmentId_idx" ON "Goal"("departmentId");

-- CreateIndex
CREATE INDEX "Goal_deletedAt_idx" ON "Goal"("deletedAt");

-- CreateIndex
CREATE INDEX "Sprint_status_startDate_idx" ON "Sprint"("status", "startDate");

-- CreateIndex
CREATE INDEX "SprintGoal_goalId_idx" ON "SprintGoal"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX "SprintGoal_goalId_key" ON "SprintGoal"("goalId");

-- CreateIndex
CREATE INDEX "GoalTarget_goalId_sortOrder_idx" ON "GoalTarget"("goalId", "sortOrder");

-- CreateIndex
CREATE INDEX "GoalProblem_goalId_status_idx" ON "GoalProblem"("goalId", "status");

-- CreateIndex
CREATE INDEX "GoalAction_status_todayOrder_idx" ON "GoalAction"("status", "todayOrder");

-- CreateIndex
CREATE INDEX "GoalAction_goalId_idx" ON "GoalAction"("goalId");

-- CreateIndex
CREATE INDEX "GoalAction_deletedAt_idx" ON "GoalAction"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FocusSession_entryId_key" ON "FocusSession"("entryId");

-- CreateIndex
CREATE INDEX "FocusSession_status_startedAt_idx" ON "FocusSession"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_weekStartDate_key" ON "WeeklyReview"("weekStartDate");

-- CreateIndex
CREATE INDEX "WeightChange_changedAt_idx" ON "WeightChange"("changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RivalSectorEstimate_rivalId_subdepartmentId_key" ON "RivalSectorEstimate"("rivalId", "subdepartmentId");

-- CreateIndex
CREATE INDEX "UnclaimedBlock_date_idx" ON "UnclaimedBlock"("date");

-- CreateIndex
CREATE INDEX "NeutralEntry_date_idx" ON "NeutralEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DayAllowance_date_key" ON "DayAllowance"("date");

-- AddForeignKey
ALTER TABLE "Subdepartment" ADD CONSTRAINT "Subdepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_subdepartmentId_fkey" FOREIGN KEY ("subdepartmentId") REFERENCES "Subdepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintGoal" ADD CONSTRAINT "SprintGoal_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintGoal" ADD CONSTRAINT "SprintGoal_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalTarget" ADD CONSTRAINT "GoalTarget_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalTarget" ADD CONSTRAINT "GoalTarget_subdepartmentId_fkey" FOREIGN KEY ("subdepartmentId") REFERENCES "Subdepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalProblem" ADD CONSTRAINT "GoalProblem_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalProblem" ADD CONSTRAINT "GoalProblem_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "GoalTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalAction" ADD CONSTRAINT "GoalAction_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalAction" ADD CONSTRAINT "GoalAction_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "GoalTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalAction" ADD CONSTRAINT "GoalAction_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "GoalProblem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalAction" ADD CONSTRAINT "GoalAction_subdepartmentId_fkey" FOREIGN KEY ("subdepartmentId") REFERENCES "Subdepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusSession" ADD CONSTRAINT "FocusSession_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "GoalAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusSession" ADD CONSTRAINT "FocusSession_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightChange" ADD CONSTRAINT "WeightChange_subdepartmentId_fkey" FOREIGN KEY ("subdepartmentId") REFERENCES "Subdepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RivalSectorEstimate" ADD CONSTRAINT "RivalSectorEstimate_rivalId_fkey" FOREIGN KEY ("rivalId") REFERENCES "Rival"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RivalSectorEstimate" ADD CONSTRAINT "RivalSectorEstimate_subdepartmentId_fkey" FOREIGN KEY ("subdepartmentId") REFERENCES "Subdepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

