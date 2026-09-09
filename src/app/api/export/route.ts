import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dateKeyFromUtc } from '@/lib/dates'

// GET /api/export — full app state as JSON for backup.
export async function GET() {
  const [departments, subdepartments, entries, weeklyReviews, weightChanges, rivals, rivalEstimates, unproductiveBlocks, dayAllowances, neutralEntries, goals, goalDepartments, sprints, sprintGoals, goalTargets, goalProblems, goalActions, sessions, preference] =
    await Promise.all([
      db.department.findMany(),
      db.subdepartment.findMany(),
      db.entry.findMany(),
      db.weeklyReview.findMany(),
      db.weightChange.findMany(),
      db.rival.findMany(),
      db.rivalSectorEstimate.findMany(),
      db.unproductiveBlock.findMany(),
      db.dayAllowance.findMany(),
      db.neutralEntry.findMany(),
      db.goal.findMany(),
      db.goalDepartment.findMany(),
      db.sprint.findMany(),
      db.sprintGoal.findMany(),
      db.goalTarget.findMany(),
      db.goalProblem.findMany(),
      db.goalAction.findMany(),
      db.workSession.findMany(),
      db.workspacePreference.findUnique({ where: { id: 1 } }),
    ])
  return NextResponse.json({
    version: 9,
    departments,
    subdepartments,
    entries: entries.map((e) => ({ ...e, entryTimestamp: e.entryTimestamp.toISOString(), createdAt: e.createdAt.toISOString() })),
    weeklyReviews: weeklyReviews.map((r) => ({ ...r, weekStartDate: dateKeyFromUtc(r.weekStartDate), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
    weightChanges: weightChanges.map((c) => ({ ...c, changedAt: c.changedAt.toISOString() })),
    rivals,
    rivalEstimates,
    unproductiveBlocks: unproductiveBlocks.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() })),
    dayAllowances: dayAllowances.map((a) => ({ date: a.date, sleepMinutes: a.sleepMinutes, neutralMinutes: a.neutralMinutes })),
    neutralEntries: neutralEntries.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    goals,
    goalDepartments,
    sprints,
    sprintGoals,
    goalTargets,
    goalProblems,
    goalActions,
    sessions,
    preference: preference ? { timezone: preference.timezone } : null,
  })
}
