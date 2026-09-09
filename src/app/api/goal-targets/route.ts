import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const SOURCES = new Set(['manual', 'productive_minutes', 'completed_actions', 'outputs'])

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const goalId = String(body.goalId ?? '')
  const label = String(body.label ?? '').trim().slice(0, 120)
  const targetValue = Number(body.targetValue)
  const requestedCurrentValue = Number(body.currentValue ?? 0)
  const source = String(body.progressSource ?? 'manual')
  if (!goalId || !label || !Number.isFinite(targetValue) || targetValue <= 0 || !Number.isFinite(requestedCurrentValue)) {
    return NextResponse.json({ error: 'goal, label, and a positive target are required' }, { status: 400 })
  }
  if (!SOURCES.has(source)) return NextResponse.json({ error: 'invalid progress source' }, { status: 400 })

  const goal = await db.goal.findUnique({ where: { id: goalId }, include: { departments: { select: { departmentId: true } } } })
  if (!goal) return NextResponse.json({ error: 'goal not found' }, { status: 400 })
  const subdepartmentId = body.subdepartmentId ? String(body.subdepartmentId) : null
  if (subdepartmentId) {
    const allowedDepartmentIds = [goal.departmentId, ...goal.departments.map((membership) => membership.departmentId)]
    const sub = await db.subdepartment.findFirst({ where: { id: subdepartmentId, departmentId: { in: allowedDepartmentIds } } })
    if (!sub) return NextResponse.json({ error: 'subdepartment does not belong to the goal department' }, { status: 400 })
  }
  const count = await db.goalTarget.count({ where: { goalId } })
  const target = await db.goalTarget.create({
    data: {
      goalId,
      subdepartmentId,
      label,
      unit: String(body.unit ?? 'percent').trim().slice(0, 30),
      targetValue,
      // Derived Measures read their value from Entries or completed Steps.
      // Never seed a second, conflicting source of truth from client input.
      currentValue: source === 'manual' ? Math.max(0, requestedCurrentValue) : 0,
      progressSource: source,
      weight: Math.max(0.01, Number(body.weight ?? 1)),
      sortOrder: count,
    },
  })
  return NextResponse.json({ target })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const existing = await db.goalTarget.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'measure not found' }, { status: 404 })
  const data: Record<string, string | number | null> = {}
  if (body.label !== undefined) data.label = String(body.label).trim().slice(0, 120)
  if (body.unit !== undefined) data.unit = String(body.unit).trim().slice(0, 30)
  for (const key of ['targetValue', 'currentValue', 'weight'] as const) {
    if (body[key] !== undefined) {
      const value = Number(body[key])
      if (!Number.isFinite(value) || value < 0 || (key !== 'currentValue' && value === 0)) {
        return NextResponse.json({ error: `invalid ${key}` }, { status: 400 })
      }
      data[key] = value
    }
  }
  const nextSource = body.progressSource === undefined ? existing.progressSource : String(body.progressSource)
  if (!SOURCES.has(nextSource)) return NextResponse.json({ error: 'invalid progress source' }, { status: 400 })
  if (body.currentValue !== undefined && nextSource !== 'manual') {
    return NextResponse.json({ error: 'derived Measures cannot edit current value' }, { status: 400 })
  }
  if (body.progressSource !== undefined) data.progressSource = nextSource
  if (nextSource !== 'manual') data.currentValue = 0
  const target = await db.goalTarget.update({ where: { id }, data })
  return NextResponse.json({ target })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.goalTarget.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

