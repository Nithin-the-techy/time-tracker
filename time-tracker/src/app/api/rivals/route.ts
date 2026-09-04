import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/rivals — all rivals + their per-sector estimates (now per-sub-department)
export async function GET() {
  const rivals = await db.rival.findMany({
    include: {
      sectorEstimates: {
        include: {
          subdepartment: {
            include: { department: { select: { name: true, slug: true } } },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({
    rivals: rivals.map((r) => ({
      id: r.id,
      name: r.name,
      regionLabel: r.regionLabel,
      notes: r.notes,
      sectorEstimates: r.sectorEstimates.map((s) => ({
        id: s.id,
        subdepartmentId: s.subdepartmentId,
        subdepartmentName: s.subdepartment.name,
        departmentName: s.subdepartment.department.name,
        estimatedWeeklyMinutes: s.estimatedWeeklyMinutes,
        weight: s.subdepartment.valueWeight,
      })),
    })),
  })
}

// POST /api/rivals
// Body: { name, regionLabel, notes? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim()
  const regionLabel = String(body.regionLabel ?? '').trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const rival = await db.rival.create({
    data: { name, regionLabel, notes: body.notes ? String(body.notes) : null },
  })
  return NextResponse.json({ rival })
}
