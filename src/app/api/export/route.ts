import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/export — full app state as JSON for backup.
export async function GET() {
  const [departments, subdepartments, entries, weeklyReviews, weightChanges, rivals, rivalEstimates, unproductiveBlocks, dayAllowances, neutralEntries, goals, goalTargets, goalProblems, goalActions, focusSessions] =
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
      db.goalTarget.findMany(),
      db.goalProblem.findMany(),
      db.goalAction.findMany(),
      db.focusSession.findMany(),
    ])
  return NextResponse.json({
    version: 5,
    departments,
    subdepartments,
    entries: entries.map((e) => ({ ...e, entryTimestamp: e.entryTimestamp.toISOString(), createdAt: e.createdAt.toISOString() })),
    weeklyReviews: weeklyReviews.map((r) => ({ ...r, weekStartDate: r.weekStartDate.toISOString().slice(0, 10), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
    weightChanges: weightChanges.map((c) => ({ ...c, changedAt: c.changedAt.toISOString() })),
    rivals,
    rivalEstimates,
    unproductiveBlocks: unproductiveBlocks.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() })),
    dayAllowances: dayAllowances.map((a) => ({ date: a.date, sleepMinutes: a.sleepMinutes, neutralMinutes: a.neutralMinutes })),
    neutralEntries: neutralEntries.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    goals,
    goalTargets,
    goalProblems,
    goalActions,
    focusSessions,
  })
}
