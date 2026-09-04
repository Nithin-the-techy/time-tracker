import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH /api/rivals/[id]
// Body: { name?, regionLabel?, notes?, sectorEstimates?: [{ subdepartmentId, estimatedWeeklyMinutes }] }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const data: { name?: string; regionLabel?: string; notes?: string | null } = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (typeof body.regionLabel === 'string') data.regionLabel = body.regionLabel.trim()
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null

  const updated = await db.rival.update({ where: { id }, data })

  // Upsert sector estimates (now keyed by subdepartmentId)
  if (Array.isArray(body.sectorEstimates)) {
    for (const est of body.sectorEstimates) {
      const subdepartmentId = String(est.subdepartmentId ?? '')
      const estimatedWeeklyMinutes = Math.max(0, Math.round(Number(est.estimatedWeeklyMinutes ?? 0)))
      if (!subdepartmentId) continue
      const existing = await db.rivalSectorEstimate.findUnique({
        where: { rivalId_subdepartmentId: { rivalId: id, subdepartmentId } },
      })
      if (existing) {
        await db.rivalSectorEstimate.update({
          where: { id: existing.id },
          data: { estimatedWeeklyMinutes },
        })
      } else {
        await db.rivalSectorEstimate.create({
          data: { rivalId: id, subdepartmentId, estimatedWeeklyMinutes },
        })
      }
    }
  }

  return NextResponse.json({ rival: updated })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await db.rival.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
