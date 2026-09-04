import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/subdepartments
// Body: { departmentId, name, sortOrder? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const departmentId = String(body.departmentId ?? '')
  const name = String(body.name ?? '').trim()
  if (!departmentId || !name) {
    return NextResponse.json({ error: 'departmentId and name required' }, { status: 400 })
  }
  const existing = await db.subdepartment.findUnique({
    where: { departmentId_name: { departmentId, name } },
  })
  if (existing) {
    return NextResponse.json({ subdepartment: existing }, { status: 200 })
  }
  const maxOrder = await db.subdepartment.aggregate({
    where: { departmentId },
    _max: { sortOrder: true },
  })
  const sub = await db.subdepartment.create({
    data: {
      departmentId,
      name,
      sortOrder: body.sortOrder != null ? Number(body.sortOrder) : (maxOrder._max.sortOrder ?? -1) + 1,
      isActive: true,
    },
  })
  return NextResponse.json({ subdepartment: sub })
}
