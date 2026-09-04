import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/weekly-reviews?weekStart=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const weekStart = url.searchParams.get('weekStart')
  if (!weekStart) return NextResponse.json({ error: 'weekStart required' }, { status: 400 })
  const parsed = new Date(weekStart + 'T00:00:00')
  if (isNaN(parsed.getTime())) return NextResponse.json({ error: 'invalid date' }, { status: 400 })

  const review = await db.weeklyReview.findUnique({ where: { weekStartDate: parsed } })
  return NextResponse.json({
    review: review
      ? {
          id: review.id,
          weekStartDate: review.weekStartDate.toISOString().slice(0, 10),
          whatMattered: review.whatMattered,
          bottleneck: review.bottleneck,
          nextChange: review.nextChange,
          updatedAt: review.updatedAt.toISOString(),
        }
      : null,
  })
}

// POST /api/weekly-reviews
// Body: { weekStartDate, whatMattered?, bottleneck?, nextChange? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const ws = String(body.weekStartDate ?? '')
  const parsed = new Date(ws + 'T00:00:00')
  if (isNaN(parsed.getTime())) return NextResponse.json({ error: 'invalid weekStartDate' }, { status: 400 })

  const whatMattered = body.whatMattered ? String(body.whatMattered).slice(0, 5000) : null
  const bottleneck = body.bottleneck ? String(body.bottleneck).slice(0, 5000) : null
  const nextChange = body.nextChange ? String(body.nextChange).slice(0, 5000) : null

  const review = await db.weeklyReview.upsert({
    where: { weekStartDate: parsed },
    update: { whatMattered, bottleneck, nextChange },
    create: { weekStartDate: parsed, whatMattered, bottleneck, nextChange },
  })
  return NextResponse.json({
    review: {
      id: review.id,
      weekStartDate: review.weekStartDate.toISOString().slice(0, 10),
      whatMattered: review.whatMattered,
      bottleneck: review.bottleneck,
      nextChange: review.nextChange,
      updatedAt: review.updatedAt.toISOString(),
    },
  })
}
