import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const STATUSES = new Set(['draft', 'active', 'paused', 'completed', 'abandoned', 'archived'])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const data: Record<string, string | number | null | Date> = {}

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

  if (body.status !== undefined && String(body.status) !== 'archived') data.archivedAt = null
  const goal = await db.goal.update({ where: { id }, data })
  return NextResponse.json({ goal })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.goal.update({ where: { id }, data: { status: 'archived', archivedAt: new Date(), deletedAt: new Date() } })
  return NextResponse.json({ ok: true })
}

