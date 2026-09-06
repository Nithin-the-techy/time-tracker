import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const STATUSES = new Set(['planned', 'active', 'paused', 'completed', 'archived'])

const include = {
  goals: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      goal: { include: { department: true, targets: true, actions: true } },
    },
  },
}

export async function GET() {
  const sprints = await db.sprint.findMany({
    include,
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
  })
  return NextResponse.json({ sprints })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim().slice(0, 160)
  const phase = body.phase ? String(body.phase).trim().slice(0, 240) : null
  const startDate = String(body.startDate ?? '')
  const endDate = String(body.endDate ?? '')
  const status = String(body.status ?? 'planned')
  const goalIds = Array.isArray(body.goalIds) ? body.goalIds.map(String).filter(Boolean) : []

  if (!name || !DATE_KEY.test(startDate) || !DATE_KEY.test(endDate)) {
    return NextResponse.json({ error: 'name, start date, and end date are required' }, { status: 400 })
  }
  if (endDate < startDate) return NextResponse.json({ error: 'end date must be on or after start date' }, { status: 400 })
  if (!STATUSES.has(status)) return NextResponse.json({ error: 'invalid sprint status' }, { status: 400 })

  const sprint = await db.sprint.create({
    data: {
      name,
      phase,
      startDate,
      endDate,
      status,
      notes: body.notes ? String(body.notes).slice(0, 2000) : null,
      goals: goalIds.length ? { create: goalIds.map((goalId, sortOrder) => ({ goalId, sortOrder })) } : undefined,
    },
    include,
  })
  return NextResponse.json({ sprint })
}
