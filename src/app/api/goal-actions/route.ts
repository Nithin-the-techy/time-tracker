import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const STATUSES = new Set(['backlog', 'today', 'in_progress', 'completed', 'cancelled'])
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const goalId = String(body.goalId ?? '')
  const title = String(body.title ?? '').trim().slice(0, 240)
  const plannedMinutes = Math.round(Number(body.plannedMinutes ?? 25))
  const status = String(body.status ?? 'backlog')
  if (!goalId || !title || plannedMinutes < 1 || plannedMinutes > 720 || !STATUSES.has(status)) {
    return NextResponse.json({ error: 'goal, title, and planned minutes (1–720) are required' }, { status: 400 })
  }
  if (status === 'today') {
    const committed = await db.goalAction.count({ where: { status: { in: ['today', 'in_progress'] } } })
    if (committed >= 3) return NextResponse.json({ error: 'Today is full: finish, defer, or cancel an action first' }, { status: 409 })
  }
  const goal = await db.goal.findUnique({ where: { id: goalId } })
  if (!goal) return NextResponse.json({ error: 'goal not found' }, { status: 400 })

  const subdepartmentId = body.subdepartmentId ? String(body.subdepartmentId) : null
  if (subdepartmentId) {
    const sub = await db.subdepartment.findFirst({ where: { id: subdepartmentId, departmentId: goal.departmentId } })
    if (!sub) return NextResponse.json({ error: 'subdepartment does not belong to goal department' }, { status: 400 })
  }
  const targetId = body.targetId ? String(body.targetId) : null
  if (targetId) {
    const target = await db.goalTarget.findFirst({ where: { id: targetId, goalId } })
    if (!target) return NextResponse.json({ error: 'target does not belong to goal' }, { status: 400 })
  }
  const problemId = body.problemId ? String(body.problemId) : null
  if (problemId) {
    const problem = await db.goalProblem.findFirst({ where: { id: problemId, goalId } })
    if (!problem) return NextResponse.json({ error: 'problem does not belong to goal' }, { status: 400 })
  }
  const dueDate = body.dueDate ? String(body.dueDate) : null
  if (dueDate && !DATE_KEY.test(dueDate)) return NextResponse.json({ error: 'invalid due date' }, { status: 400 })

  const todayOrder = status === 'today'
    ? await db.goalAction.count({ where: { status: { in: ['today', 'in_progress'] } } })
    : null
  const action = await db.goalAction.create({
    data: {
      goalId,
      targetId,
      problemId,
      subdepartmentId,
      title,
      context: String(body.context ?? 'deep').trim().slice(0, 60),
      plannedMinutes,
      dueDate,
      status,
      todayOrder,
      definitionOfDone: body.definitionOfDone ? String(body.definitionOfDone).slice(0, 1000) : null,
    },
  })
  return NextResponse.json({ action })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const existing = await db.goalAction.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'action not found' }, { status: 404 })
  const data: Record<string, string | number | null> = {}
  if (body.title !== undefined) data.title = String(body.title).trim().slice(0, 240)
  if (body.context !== undefined) data.context = String(body.context).trim().slice(0, 60)
  if (body.definitionOfDone !== undefined) data.definitionOfDone = body.definitionOfDone ? String(body.definitionOfDone).slice(0, 1000) : null
  if (body.output !== undefined) data.output = body.output ? String(body.output).slice(0, 2000) : null
  if (body.plannedMinutes !== undefined) {
    const minutes = Math.round(Number(body.plannedMinutes))
    if (minutes < 1 || minutes > 720) return NextResponse.json({ error: 'planned minutes must be 1–720' }, { status: 400 })
    data.plannedMinutes = minutes
  }
  if (body.status !== undefined) {
    const status = String(body.status)
    if (!STATUSES.has(status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    if (status === 'today' && existing.status !== 'today' && existing.status !== 'in_progress') {
      const committed = await db.goalAction.count({ where: { status: { in: ['today', 'in_progress'] } } })
      if (committed >= 3) return NextResponse.json({ error: 'Today is full: maximum three committed actions' }, { status: 409 })
      data.todayOrder = committed
    }
    if (status === 'backlog' || status === 'completed' || status === 'cancelled') data.todayOrder = null
    data.status = status
  }
  const action = await db.goalAction.update({ where: { id }, data })
  return NextResponse.json({ action })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.goalAction.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

