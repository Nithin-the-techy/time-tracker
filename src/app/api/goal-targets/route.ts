import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const SOURCES = new Set(['manual', 'productive_minutes', 'completed_actions', 'outputs'])

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const goalId = String(body.goalId ?? '')
  const label = String(body.label ?? '').trim().slice(0, 120)
  const targetValue = Number(body.targetValue)
  const currentValue = Number(body.currentValue ?? 0)
  const source = String(body.progressSource ?? 'manual')
  if (!goalId || !label || !Number.isFinite(targetValue) || targetValue <= 0 || !Number.isFinite(currentValue)) {
    return NextResponse.json({ error: 'goal, label, and a positive target are required' }, { status: 400 })
  }
  if (!SOURCES.has(source)) return NextResponse.json({ error: 'invalid progress source' }, { status: 400 })

  const goal = await db.goal.findUnique({ where: { id: goalId } })
  if (!goal) return NextResponse.json({ error: 'goal not found' }, { status: 400 })
  const subdepartmentId = body.subdepartmentId ? String(body.subdepartmentId) : null
  if (subdepartmentId) {
    const sub = await db.subdepartment.findFirst({ where: { id: subdepartmentId, departmentId: goal.departmentId } })
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
      currentValue: Math.max(0, currentValue),
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
  if (body.progressSource !== undefined) {
    const source = String(body.progressSource)
    if (!SOURCES.has(source)) return NextResponse.json({ error: 'invalid progress source' }, { status: 400 })
    data.progressSource = source
  }
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

