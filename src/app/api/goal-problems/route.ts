import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const STATUSES = new Set(['open', 'solved', 'accepted'])

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const goalId = String(body.goalId ?? '')
  const statement = String(body.statement ?? '').trim().slice(0, 500)
  if (!goalId || !statement) return NextResponse.json({ error: 'goal and problem statement are required' }, { status: 400 })
  const goal = await db.goal.findFirst({ where: { id: goalId, deletedAt: null } })
  if (!goal) return NextResponse.json({ error: 'goal not found' }, { status: 400 })
  const targetId = body.targetId ? String(body.targetId) : null
  if (targetId && !(await db.goalTarget.findFirst({ where: { id: targetId, goalId } }))) {
    return NextResponse.json({ error: 'measure does not belong to goal' }, { status: 400 })
  }
  const problem = await db.goalProblem.create({
    data: {
      goalId,
      targetId,
      statement,
      evidence: body.evidence ? String(body.evidence).slice(0, 1000) : null,
      severity: Math.min(5, Math.max(1, Math.round(Number(body.severity ?? 3)))),
    },
  })
  return NextResponse.json({ problem })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const existing = await db.goalProblem.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'blocker not found' }, { status: 404 })
  const data: Record<string, string | number | null> = {}
  if (body.statement !== undefined) data.statement = String(body.statement).trim().slice(0, 500)
  if (body.evidence !== undefined) data.evidence = body.evidence ? String(body.evidence).slice(0, 1000) : null
  if (body.severity !== undefined) data.severity = Math.min(5, Math.max(1, Math.round(Number(body.severity))))
  if (body.status !== undefined) {
    const status = String(body.status)
    if (!STATUSES.has(status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    data.status = status
  }
  if (body.targetId !== undefined) {
    const targetId = body.targetId ? String(body.targetId) : null
    if (targetId && !(await db.goalTarget.findFirst({ where: { id: targetId, goalId: existing.goalId } }))) {
      return NextResponse.json({ error: 'measure does not belong to blocker Outcome' }, { status: 400 })
    }
    data.targetId = targetId
  }
  const problem = await db.goalProblem.update({ where: { id }, data })
  return NextResponse.json({ problem })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.goalProblem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

