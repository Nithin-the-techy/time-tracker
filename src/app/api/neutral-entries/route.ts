import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isDateKey, validMinutes, wouldExceedDay } from '@/lib/time-validation'

// GET /api/neutral-entries?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const where: { date?: { gte?: string; lte?: string } } = {}
  if (from && to) {
    where.date = { gte: from, lte: to }
  }
  const entries = await db.neutralEntry.findMany({ where, orderBy: { date: 'asc' } })
  return NextResponse.json({
    entries: entries.map((n) => ({
      id: n.id,
      date: n.date,
      activity: n.activity,
      minutes: n.minutes,
      note: n.note,
      createdAt: n.createdAt.toISOString(),
    })),
  })
}

// POST /api/neutral-entries
// Body: { date, activity, minutes, note? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const date = String(body.date ?? '')
  const activity = String(body.activity ?? '').trim().toLowerCase().slice(0, 40)
  const minutes = validMinutes(body.minutes, 1440)
  const note = body.note ? String(body.note).slice(0, 1000) : null

  if (!date || !activity || minutes === null) {
    return NextResponse.json({ error: 'date, activity, minutes required' }, { status: 400 })
  }
  if (!isDateKey(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }
  if (await wouldExceedDay(date, minutes)) return NextResponse.json({ error: 'This log would put the day above 24 hours' }, { status: 409 })

  const entry = await db.neutralEntry.create({
    data: { date, activity, minutes, note },
  })
  return NextResponse.json({
    entry: {
      id: entry.id,
      date: entry.date,
      activity: entry.activity,
      minutes: entry.minutes,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
    },
  })
}

// DELETE /api/neutral-entries (with id in body)
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.neutralEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
