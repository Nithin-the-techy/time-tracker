import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/allowances — all per-day overrides (the dataset is tiny).
export async function GET() {
  const rows = await db.dayAllowance.findMany({ orderBy: { date: 'asc' } })
  return NextResponse.json({
    allowances: rows.map((a) => ({
      date: a.date,
      sleepMinutes: a.sleepMinutes,
      neutralMinutes: a.neutralMinutes,
    })),
  })
}

// PUT /api/allowances — upsert one day's override.
// Body: { date, sleepMinutes?: number | null, neutralMinutes?: number | null }
// Passing null clears that field back to default behavior; omitting a field
// leaves what's stored untouched on update.
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const date = String(body.date ?? '')
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }

  const hasSleep = 'sleepMinutes' in body
  const hasNeutral = 'neutralMinutes' in body
  if (!hasSleep && !hasNeutral) {
    return NextResponse.json({ error: 'sleepMinutes or neutralMinutes required' }, { status: 400 })
  }

  const clamp = (v: unknown, max: number) => {
    const n = Math.round(Number(v))
    if (!Number.isFinite(n) || n < 0 || n > max) return null
    return n
  }
  const sleep = hasSleep ? clamp(body.sleepMinutes ?? null, 840) : undefined
  const neutral = hasNeutral ? clamp(body.neutralMinutes ?? null, 600) : undefined
  if (hasSleep && body.sleepMinutes !== null && sleep === null) {
    return NextResponse.json({ error: 'sleepMinutes must be 0–840' }, { status: 400 })
  }
  if (hasNeutral && body.neutralMinutes !== null && neutral === null) {
    return NextResponse.json({ error: 'neutralMinutes must be 0–600' }, { status: 400 })
  }

  const row = await db.dayAllowance.upsert({
    where: { date },
    create: {
      date,
      ...(sleep !== undefined ? { sleepMinutes: sleep } : {}),
      ...(neutral !== undefined ? { neutralMinutes: neutral } : {}),
    },
    update: {
      ...(sleep !== undefined ? { sleepMinutes: sleep } : {}),
      ...(neutral !== undefined ? { neutralMinutes: neutral } : {}),
    },
  })

  return NextResponse.json({
    allowance: {
      date: row.date,
      sleepMinutes: row.sleepMinutes,
      neutralMinutes: row.neutralMinutes,
    },
  })
}

// DELETE /api/allowances — remove a day's override entirely.
// Body: { date }
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const date = String(body.date ?? '')
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }
  await db.dayAllowance.deleteMany({ where: { date } })
  return NextResponse.json({ ok: true })
}
