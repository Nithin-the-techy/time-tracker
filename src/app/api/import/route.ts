import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// A restore is validated before it starts and committed as one transaction.
// A malformed new backup cannot leave the old database half-deleted.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const validationError = validateBackup(body)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  try {
    await db.$transaction(async (tx) => {
      await tx.focusSession.deleteMany()
      await tx.goalAction.deleteMany()
      await tx.goalProblem.deleteMany()
      await tx.goalTarget.deleteMany()
      await tx.goal.deleteMany()
      await tx.entry.deleteMany()
      await tx.weightChange.deleteMany()
      await tx.rivalSectorEstimate.deleteMany()
      await tx.rival.deleteMany()
      await tx.unproductiveBlock.deleteMany()
      await tx.dayAllowance.deleteMany()
      await tx.neutralEntry.deleteMany()
      await tx.subdepartment.deleteMany()
      await tx.department.deleteMany()
      await tx.weeklyReview.deleteMany()

      for (const d of body.departments ?? []) {
        await tx.department.create({ data: { id: d.id, name: d.name, slug: d.slug, sortOrder: d.sortOrder, subType: d.subType ?? 'freeform', moduleKey: d.moduleKey ?? 'generic' } })
      }
      for (const s of body.subdepartments ?? []) {
        await tx.subdepartment.create({ data: { id: s.id, departmentId: s.departmentId, name: s.name, isActive: s.isActive ?? true, sortOrder: s.sortOrder ?? 0, valueWeight: s.valueWeight ?? 1 } })
      }
      for (const g of body.goals ?? []) {
        await tx.goal.create({ data: { id: g.id, departmentId: g.departmentId, title: g.title, outcome: g.outcome, whyNow: g.whyNow ?? null, constraints: g.constraints ?? null, moduleKey: g.moduleKey ?? 'generic', status: g.status ?? 'active', priority: g.priority ?? 3, startDate: g.startDate, targetDate: g.targetDate, reviewCadence: g.reviewCadence ?? 'weekly', createdAt: new Date(g.createdAt ?? Date.now()) } })
      }
      for (const t of body.goalTargets ?? []) {
        await tx.goalTarget.create({ data: { id: t.id, goalId: t.goalId, subdepartmentId: t.subdepartmentId ?? null, label: t.label, unit: t.unit ?? 'percent', targetValue: t.targetValue, currentValue: t.currentValue ?? 0, progressSource: t.progressSource ?? 'manual', weight: t.weight ?? 1, sortOrder: t.sortOrder ?? 0 } })
      }
      for (const p of body.goalProblems ?? []) {
        await tx.goalProblem.create({ data: { id: p.id, goalId: p.goalId, targetId: p.targetId ?? null, statement: p.statement, evidence: p.evidence ?? null, severity: p.severity ?? 3, status: p.status ?? 'open', createdAt: new Date(p.createdAt ?? Date.now()) } })
      }
      for (const a of body.goalActions ?? []) {
        await tx.goalAction.create({ data: { id: a.id, goalId: a.goalId, targetId: a.targetId ?? null, problemId: a.problemId ?? null, subdepartmentId: a.subdepartmentId ?? null, title: a.title, context: a.context ?? 'deep', plannedMinutes: a.plannedMinutes ?? 25, dueDate: a.dueDate ?? null, status: a.status ?? 'backlog', todayOrder: a.todayOrder ?? null, definitionOfDone: a.definitionOfDone ?? null, output: a.output ?? null, createdAt: new Date(a.createdAt ?? Date.now()) } })
      }
      for (const e of body.entries ?? []) {
        await tx.entry.create({ data: { id: e.id, departmentId: e.departmentId, subdepartmentId: e.subdepartmentId, entryTimestamp: new Date(e.entryTimestamp), durationMinutes: e.durationMinutes, note: e.note ?? null, obsidianRef: e.obsidianRef ?? null, createdAt: new Date(e.createdAt ?? Date.now()) } })
      }
      for (const s of body.focusSessions ?? []) {
        await tx.focusSession.create({ data: { id: s.id, actionId: s.actionId, entryId: s.entryId ?? null, startedAt: new Date(s.startedAt), endedAt: s.endedAt ? new Date(s.endedAt) : null, status: s.status ?? 'completed', actualMinutes: s.actualMinutes ?? null, output: s.output ?? null, friction: s.friction ?? null, createdAt: new Date(s.createdAt ?? Date.now()) } })
      }
      for (const r of body.weeklyReviews ?? []) {
        await tx.weeklyReview.create({ data: { id: r.id, weekStartDate: new Date(`${r.weekStartDate}T00:00:00`), whatMattered: r.whatMattered ?? null, bottleneck: r.bottleneck ?? null, nextChange: r.nextChange ?? null } })
      }
      for (const c of body.weightChanges ?? []) {
        await tx.weightChange.create({ data: { id: c.id, subdepartmentId: c.subdepartmentId, oldWeight: c.oldWeight, newWeight: c.newWeight, changedAt: new Date(c.changedAt) } })
      }
      for (const r of body.rivals ?? []) {
        await tx.rival.create({ data: { id: r.id, name: r.name, regionLabel: r.regionLabel ?? '', notes: r.notes ?? null } })
      }
      for (const s of body.rivalEstimates ?? []) {
        await tx.rivalSectorEstimate.create({ data: { id: s.id, rivalId: s.rivalId, subdepartmentId: s.subdepartmentId, estimatedWeeklyMinutes: s.estimatedWeeklyMinutes } })
      }
      for (const b of body.unproductiveBlocks ?? body.unclaimedBlocks ?? []) {
        await tx.unproductiveBlock.create({ data: { id: b.id, date: b.date, tag: b.tag, minutes: b.minutes, note: b.note ?? null, createdAt: new Date(b.createdAt ?? Date.now()) } })
      }
      for (const a of body.dayAllowances ?? []) {
        await tx.dayAllowance.create({ data: { date: a.date, sleepMinutes: a.sleepMinutes ?? null, neutralMinutes: a.neutralMinutes ?? null } })
      }
      for (const n of body.neutralEntries ?? []) {
        await tx.neutralEntry.create({ data: { id: n.id, date: n.date, activity: n.activity, minutes: n.minutes, note: n.note ?? null, createdAt: new Date(n.createdAt ?? Date.now()) } })
      }
    })
  } catch (error) {
    console.error('Backup import failed', error)
    return NextResponse.json({ error: 'Backup could not be imported; existing data was preserved' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

function validateBackup(body: any): string | null {
  if (!body || !Array.isArray(body.departments) || !Array.isArray(body.subdepartments) || !Array.isArray(body.entries)) {
    return 'Invalid backup: departments, subdepartments, and entries arrays are required'
  }
  const rowsHaveIds = (rows: any[]) => rows.every((row) => row && typeof row.id === 'string' && row.id.length > 0)
  if (![body.departments, body.subdepartments, body.entries].every(rowsHaveIds)) return 'Invalid backup: every core record needs an id'
  const departmentIds = new Set(body.departments.map((d: any) => d.id))
  const subdepartmentIds = new Set(body.subdepartments.map((s: any) => s.id))
  if (body.subdepartments.some((s: any) => !departmentIds.has(s.departmentId))) return 'Invalid backup: orphaned subdepartment'
  if (body.entries.some((e: any) => !departmentIds.has(e.departmentId) || !subdepartmentIds.has(e.subdepartmentId) || !Number.isFinite(Number(e.durationMinutes)))) {
    return 'Invalid backup: malformed or orphaned time entry'
  }
  return null
}

