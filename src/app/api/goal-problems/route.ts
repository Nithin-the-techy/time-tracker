import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const STATUSES = new Set(['open', 'solved', 'accepted'])

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const goalId = String(body.goalId ?? '')
  const statement = String(body.statement ?? '').trim().slice(0, 500)
  if (!goalId || !statement) return NextResponse.json({ error: 'goal and problem statement are required' }, { status: 400 })
  const problem = await db.goalProblem.create({
    data: {
      goalId,
      targetId: body.targetId ? String(body.targetId) : null,
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
  const data: Record<string, string | number | null> = {}
  if (body.statement !== undefined) data.statement = String(body.statement).trim().slice(0, 500)
  if (body.evidence !== undefined) data.evidence = body.evidence ? String(body.evidence).slice(0, 1000) : null
  if (body.severity !== undefined) data.severity = Math.min(5, Math.max(1, Math.round(Number(body.severity))))
  if (body.status !== undefined) {
    const status = String(body.status)
    if (!STATUSES.has(status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    data.status = status
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

