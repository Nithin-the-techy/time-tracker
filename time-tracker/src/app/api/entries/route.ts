import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  const where: { entryTimestamp?: { gte?: Date; lte?: Date } } = {}
  if (from && to) {
    where.entryTimestamp = {
      gte: new Date(from + 'T00:00:00'),
      lte: new Date(to + 'T23:59:59'),
    }
  }

  const entries = await db.entry.findMany({
    where,
    include: {
      department: true,
      subdepartment: true,
    },
    orderBy: { entryTimestamp: 'desc' },
  })

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      departmentId: e.departmentId,
      subdepartmentId: e.subdepartmentId,
      entryTimestamp: e.entryTimestamp.toISOString(),
      durationMinutes: e.durationMinutes,
      note: e.note,
      obsidianRef: e.obsidianRef,
      createdAt: e.createdAt.toISOString(),
      department: {
        id: e.department.id,
        name: e.department.name,
        slug: e.department.slug,
        sortOrder: e.department.sortOrder,
        subType: e.department.subType,
      },
      subdepartment: {
        id: e.subdepartment.id,
        name: e.subdepartment.name,
        valueWeight: e.subdepartment.valueWeight,
      },
    })),
  })
}

// POST /api/entries
// Body: { departmentId, subdepartmentId?, subdepartmentName?, entryTimestamp, durationMinutes, note?, obsidianRef? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const departmentId = String(body.departmentId ?? '')
  const durationMinutes = Number(body.durationMinutes ?? 0)
  const note = body.note ? String(body.note).slice(0, 2000) : null
  const obsidianRef = body.obsidianRef ? String(body.obsidianRef).slice(0, 500) : null

  if (!departmentId || !durationMinutes || durationMinutes <= 0) {
    return NextResponse.json({ error: 'departmentId and durationMinutes required' }, { status: 400 })
  }

  const dept = await db.department.findUnique({ where: { id: departmentId } })
  if (!dept) return NextResponse.json({ error: 'department not found' }, { status: 400 })

  let subdepartmentId: string | undefined = body.subdepartmentId ? String(body.subdepartmentId) : undefined

  if (!subdepartmentId && body.subdepartmentName) {
    const name = String(body.subdepartmentName).trim()
    if (name) {
      const existing = await db.subdepartment.findUnique({
        where: { departmentId_name: { departmentId, name } },
      })
      if (existing) {
        subdepartmentId = existing.id
      } else {
        const maxOrder = await db.subdepartment.aggregate({
          where: { departmentId },
          _max: { sortOrder: true },
        })
        const created = await db.subdepartment.create({
          data: {
            departmentId,
            name,
            sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
            isActive: true,
            valueWeight: 1.0,
          },
        })
        subdepartmentId = created.id
      }
    }
  }

  if (!subdepartmentId) {
    return NextResponse.json({ error: 'subdepartmentId or subdepartmentName required' }, { status: 400 })
  }

  const ts = new Date(body.entryTimestamp)
  if (isNaN(ts.getTime())) {
    return NextResponse.json({ error: 'invalid entryTimestamp' }, { status: 400 })
  }

  const entry = await db.entry.create({
    data: {
      departmentId,
      subdepartmentId,
      entryTimestamp: ts,
      durationMinutes: Math.round(durationMinutes),
      note,
      obsidianRef,
    },
    include: { department: true, subdepartment: true },
  })

  return NextResponse.json({
    entry: {
      id: entry.id,
      departmentId: entry.departmentId,
      subdepartmentId: entry.subdepartmentId,
      entryTimestamp: entry.entryTimestamp.toISOString(),
      durationMinutes: entry.durationMinutes,
      note: entry.note,
      obsidianRef: entry.obsidianRef,
      createdAt: entry.createdAt.toISOString(),
      department: {
        id: entry.department.id,
        name: entry.department.name,
        slug: entry.department.slug,
        sortOrder: entry.department.sortOrder,
        subType: entry.department.subType,
      },
      subdepartment: {
        id: entry.subdepartment.id,
        name: entry.subdepartment.name,
        valueWeight: entry.subdepartment.valueWeight,
      },
    },
  })
}

// DELETE /api/entries (with id in body) — convenience
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.entry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
