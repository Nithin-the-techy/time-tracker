import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const STATUSES = new Set(['draft', 'active', 'paused', 'completed', 'abandoned', 'archived'])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({})) as Record<string, any>
  const data: Record<string, string | number | null | Date> = {}
  const hasDepartmentUpdate = body.departmentIds !== undefined || body.departmentId !== undefined

  if (body.title !== undefined) data.title = String(body.title).trim().slice(0, 160)
  if (body.outcome !== undefined) data.outcome = String(body.outcome).trim().slice(0, 1000)
  if (body.whyNow !== undefined) data.whyNow = body.whyNow ? String(body.whyNow).slice(0, 1000) : null
  if (body.constraints !== undefined) data.constraints = body.constraints ? String(body.constraints).slice(0, 1000) : null
  if (body.priority !== undefined) data.priority = Math.min(5, Math.max(1, Math.round(Number(body.priority))))
  if (body.status !== undefined) {
    const status = String(body.status)
    if (!STATUSES.has(status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    data.status = status
  }
  for (const key of ['startDate', 'targetDate'] as const) {
    if (body[key] !== undefined) {
      const value = String(body[key])
      if (!DATE_KEY.test(value)) return NextResponse.json({ error: `invalid ${key}` }, { status: 400 })
      data[key] = value
    }
  }

  const requestedDepartmentIds: string[] = body.departmentIds !== undefined
    ? Array.isArray(body.departmentIds) ? body.departmentIds.map((value: unknown) => String(value)).filter(Boolean) : []
    : [String(body.departmentId ?? '')].filter(Boolean)
  const departmentIds: string[] = [...new Set(requestedDepartmentIds)]
  if (hasDepartmentUpdate) {
    if (departmentIds.length < 1) return NextResponse.json({ error: 'choose at least one Area' }, { status: 400 })
    const departments = await db.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true } })
    if (departments.length !== departmentIds.length) return NextResponse.json({ error: 'one or more Areas not found' }, { status: 400 })
    data.departmentId = departmentIds[0]
  }

  const sprintId = body.sprintId === null ? null : body.sprintId !== undefined ? String(body.sprintId) : undefined
  if (sprintId) {
    const sprint = await db.sprint.findUnique({ where: { id: sprintId }, select: { id: true, status: true } })
    if (!sprint || sprint.status === 'archived') return NextResponse.json({ error: 'sprint not found' }, { status: 400 })
  }

  if (body.status !== undefined && String(body.status) !== 'archived') data.archivedAt = null
  const goal = sprintId === undefined && !hasDepartmentUpdate
    ? await db.goal.update({ where: { id }, data })
    : await db.$transaction(async (tx) => {
        if (hasDepartmentUpdate) {
          await tx.goalDepartment.deleteMany({ where: { goalId: id } })
          await tx.goalDepartment.createMany({ data: departmentIds.map((departmentId, sortOrder) => ({ goalId: id, departmentId, sortOrder })) })
        }
        if (sprintId !== undefined) {
          await tx.sprintGoal.deleteMany({ where: { goalId: id } })
          if (sprintId) {
            const sortOrder = await tx.sprintGoal.count({ where: { sprintId } })
            await tx.sprintGoal.create({ data: { sprintId, goalId: id, sortOrder } })
          }
        }
        return tx.goal.update({ where: { id }, data })
      })
  return NextResponse.json({ goal })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.goal.update({ where: { id }, data: { status: 'archived', archivedAt: new Date(), deletedAt: new Date() } })
  return NextResponse.json({ ok: true })
}

