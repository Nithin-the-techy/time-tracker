import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isDateKey, validMinutes, wouldExceedDay } from '@/lib/time-validation'

// GET /api/unproductive-blocks?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const where: { date?: { gte?: string; lte?: string } } = {}
  if (from && to) {
    where.date = { gte: from, lte: to }
  }
  const blocks = await db.unproductiveBlock.findMany({ where, orderBy: { date: 'asc' } })
  return NextResponse.json({
    blocks: blocks.map((b) => ({
      id: b.id,
      date: b.date,
      tag: b.tag,
      minutes: b.minutes,
      note: b.note,
      createdAt: b.createdAt.toISOString(),
    })),
  })
}

// POST /api/unproductive-blocks
// Body: { date, tag, minutes, note? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const date = String(body.date ?? '')
  const tag = String(body.tag ?? '').trim().slice(0, 40)
  const minutes = validMinutes(body.minutes, 1440)
  const note = body.note ? String(body.note).slice(0, 1000) : null

  if (!date || !tag || minutes === null) {
    return NextResponse.json({ error: 'date, tag, minutes required' }, { status: 400 })
  }
  // Free-form activity label — the log form suggests chips, anything goes.
  if (!isDateKey(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }
  if (await wouldExceedDay(date, minutes)) return NextResponse.json({ error: 'This log would put the day above 24 hours' }, { status: 409 })

  const block = await db.unproductiveBlock.create({
    data: { date, tag, minutes, note },
  })
  return NextResponse.json({
    block: {
      id: block.id,
      date: block.date,
      tag: block.tag,
      minutes: block.minutes,
      note: block.note,
      createdAt: block.createdAt.toISOString(),
    },
  })
}

// DELETE /api/unproductive-blocks (with id in body)
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.unproductiveBlock.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
