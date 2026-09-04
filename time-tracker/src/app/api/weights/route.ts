import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/weights — returns all sub-department value_weights + the audit log
export async function GET() {
  const subs = await db.subdepartment.findMany({
    where: { isActive: true },
    include: { department: { select: { name: true, slug: true } } },
    orderBy: { sortOrder: 'asc' },
  })
  const changes = await db.weightChange.findMany({
    include: { subdepartment: { include: { department: { select: { name: true, slug: true } } } } },
    orderBy: { changedAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({
    weights: subs.map((s) => ({
      id: s.id,
      name: s.name,
      valueWeight: s.valueWeight,
      departmentId: s.departmentId,
      departmentName: s.department.name,
      slug: s.department.slug,
    })),
    changes: changes.map((c) => ({
      id: c.id,
      subdepartmentId: c.subdepartmentId,
      subdepartmentName: c.subdepartment.name,
      departmentName: c.subdepartment.department.name,
      slug: c.subdepartment.department.slug,
      oldWeight: c.oldWeight,
      newWeight: c.newWeight,
      changedAt: c.changedAt.toISOString(),
    })),
  })
}

// PATCH /api/weights — body: { subdepartmentId, newWeight }
// Always inserts a WeightChange row to keep the audit log honest.
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const subdepartmentId = String(body.subdepartmentId ?? '')
  const newWeight = Number(body.newWeight)
  if (!subdepartmentId || isNaN(newWeight) || newWeight < 0.1 || newWeight > 5.0) {
    return NextResponse.json({ error: 'subdepartmentId required, newWeight must be 0.1–5.0' }, { status: 400 })
  }
  const sub = await db.subdepartment.findUnique({ where: { id: subdepartmentId } })
  if (!sub) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const oldWeight = sub.valueWeight
  if (Math.abs(oldWeight - newWeight) < 0.0001) {
    return NextResponse.json({ subdepartment: sub, noChange: true })
  }

  const [updated, change] = await db.$transaction([
    db.subdepartment.update({
      where: { id: subdepartmentId },
      data: { valueWeight: newWeight },
    }),
    db.weightChange.create({
      data: { subdepartmentId, oldWeight, newWeight },
    }),
  ])
  return NextResponse.json({ subdepartment: updated, change })
}
