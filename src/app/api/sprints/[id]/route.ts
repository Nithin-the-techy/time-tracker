import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const include = {
  goals: {
    orderBy: { sortOrder: 'asc' as const },
    include: { goal: { include: { department: true, targets: true, actions: true } } },
  },
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const data: Record<string, string | null> = {}
  for (const key of ['name', 'phase', 'status', 'startDate', 'endDate', 'notes']) {
    if (body[key] !== undefined) data[key] = body[key] === null ? null : String(body[key]).slice(0, 2000)
  }
  if (data.startDate && !DATE_KEY.test(data.startDate)) return NextResponse.json({ error: 'invalid start date' }, { status: 400 })
  if (data.endDate && !DATE_KEY.test(data.endDate)) return NextResponse.json({ error: 'invalid end date' }, { status: 400 })
  const goalIds = Array.isArray(body.goalIds) ? body.goalIds.map(String).filter(Boolean) : null

  const sprint = await db.$transaction(async (tx) => {
    if (data.status === 'active') await tx.sprint.updateMany({ where: { status: 'active', id: { not: id } }, data: { status: 'paused' } })
    if (goalIds) {
      await tx.sprintGoal.deleteMany({ where: { sprintId: id } })
      for (const [sortOrder, goalId] of goalIds.entries()) {
        await tx.sprintGoal.create({ data: { sprintId: id, goalId, sortOrder } })
      }
    }
    return tx.sprint.update({ where: { id }, data, include })
  })
  return NextResponse.json({ sprint })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.sprint.update({ where: { id }, data: { status: 'archived' } })
  return NextResponse.json({ ok: true })
}
