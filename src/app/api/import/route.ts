import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/import — full app state JSON. Wipes existing data first.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!body || !body.departments) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  await db.$transaction([
    db.entry.deleteMany(),
    db.weightChange.deleteMany(),
    db.rivalSectorEstimate.deleteMany(),
    db.rival.deleteMany(),
    db.unproductiveBlock.deleteMany(),
    db.dayAllowance.deleteMany(),
    db.neutralEntry.deleteMany(),
    db.subdepartment.deleteMany(),
    db.department.deleteMany(),
    db.weeklyReview.deleteMany(),
  ])

  // Departments
  for (const d of body.departments ?? []) {
    await db.department.create({
      data: {
        id: d.id,
        name: d.name,
        slug: d.slug,
        sortOrder: d.sortOrder,
        subType: d.subType ?? 'freeform',
      },
    })
  }

  // Subdepartments
  for (const s of body.subdepartments ?? []) {
    await db.subdepartment.create({
      data: {
        id: s.id,
        departmentId: s.departmentId,
        name: s.name,
        isActive: s.isActive ?? true,
        sortOrder: s.sortOrder ?? 0,
        valueWeight: s.valueWeight ?? 1.0,
      },
    })
  }

  // Entries
  for (const e of body.entries ?? []) {
    await db.entry.create({
      data: {
        id: e.id,
        departmentId: e.departmentId,
        subdepartmentId: e.subdepartmentId,
        entryTimestamp: new Date(e.entryTimestamp),
        durationMinutes: e.durationMinutes,
        note: e.note ?? null,
        obsidianRef: e.obsidianRef ?? null,
        createdAt: new Date(e.createdAt ?? Date.now()),
      },
    })
  }

  // Weekly reviews
  for (const r of body.weeklyReviews ?? []) {
    await db.weeklyReview.create({
      data: {
        id: r.id,
        weekStartDate: new Date(r.weekStartDate + 'T00:00:00'),
        whatMattered: r.whatMattered ?? null,
        bottleneck: r.bottleneck ?? null,
        nextChange: r.nextChange ?? null,
      },
    })
  }

  // Weight changes
  for (const c of body.weightChanges ?? []) {
    await db.weightChange.create({
      data: {
        id: c.id,
        subdepartmentId: c.subdepartmentId,
        oldWeight: c.oldWeight,
        newWeight: c.newWeight,
        changedAt: new Date(c.changedAt),
      },
    })
  }

  // Rivals
  for (const r of body.rivals ?? []) {
    await db.rival.create({
      data: {
        id: r.id,
        name: r.name,
        regionLabel: r.regionLabel ?? '',
        notes: r.notes ?? null,
      },
    })
  }
  for (const s of body.rivalEstimates ?? []) {
    await db.rivalSectorEstimate.create({
      data: {
        id: s.id,
        rivalId: s.rivalId,
        subdepartmentId: s.subdepartmentId,
        estimatedWeeklyMinutes: s.estimatedWeeklyMinutes,
      },
    })
  }

  // Unproductive blocks (accept the old "unclaimedBlocks" key from older backups)
  for (const b of body.unproductiveBlocks ?? body.unclaimedBlocks ?? []) {
    await db.unproductiveBlock.create({
      data: {
        id: b.id,
        date: b.date,
        tag: b.tag,
        minutes: b.minutes,
        note: b.note ?? null,
        createdAt: new Date(b.createdAt ?? Date.now()),
      },
    })
  }

  // Per-day allowances
  for (const a of body.dayAllowances ?? []) {
    await db.dayAllowance.create({
      data: {
        date: a.date,
        sleepMinutes: a.sleepMinutes ?? null,
        neutralMinutes: a.neutralMinutes ?? null,
      },
    })
  }

  // Neutral time logs (older backups may not have them)
  for (const n of body.neutralEntries ?? []) {
    await db.neutralEntry.create({
      data: {
        id: n.id,
        date: n.date,
        activity: n.activity,
        minutes: n.minutes,
        note: n.note ?? null,
        createdAt: new Date(n.createdAt ?? Date.now()),
      },
    })
  }

  return NextResponse.json({ ok: true })
}
