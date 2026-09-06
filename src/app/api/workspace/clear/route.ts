import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Clears activity, not the operating setup. Departments and their
// sub-departments remain so a new day can start immediately.
export async function POST() {
  await db.$transaction(async (tx) => {
    await tx.focusSession.deleteMany()
    await tx.sprintGoal.deleteMany()
    await tx.goalAction.deleteMany()
    await tx.goalProblem.deleteMany()
    await tx.goalTarget.deleteMany()
    await tx.goal.deleteMany()
    await tx.sprint.deleteMany()
    await tx.entry.deleteMany()
    await tx.weightChange.deleteMany()
    await tx.rivalSectorEstimate.deleteMany()
    await tx.rival.deleteMany()
    await tx.unproductiveBlock.deleteMany()
    await tx.dayAllowance.deleteMany()
    await tx.neutralEntry.deleteMany()
    await tx.weeklyReview.deleteMany()
  })
  return NextResponse.json({ ok: true })
}
