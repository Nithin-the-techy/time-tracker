import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [goals, actions, entries, problems] = await Promise.all([
    db.goal.findMany({ where: { OR: [{ deletedAt: { not: null } }, { status: 'archived' }] }, select: { id: true, title: true, status: true, deletedAt: true, archivedAt: true, actions: { select: { id: true, title: true, deletedAt: true } } }, orderBy: { updatedAt: 'desc' } }),
    db.goalAction.findMany({ where: { deletedAt: { not: null } }, select: { id: true, title: true, deletedAt: true, goal: { select: { title: true } } }, orderBy: { updatedAt: 'desc' } }),
    db.entry.findMany({ where: { deletedAt: { not: null } }, select: { id: true, entryTimestamp: true, durationMinutes: true, deletedAt: true, department: { select: { name: true } } }, orderBy: { deletedAt: 'desc' } }),
    db.goalProblem.findMany({ where: { archivedAt: { not: null } }, select: { id: true, statement: true, archivedAt: true, goal: { select: { title: true } } }, orderBy: { archivedAt: 'desc' } }),
  ])
  return NextResponse.json({ goals, actions, entries, problems })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const entity = String(body.entity ?? '')
  const id = String(body.id ?? '')
  const operation = String(body.operation ?? 'restore')
  if (!id || !['goal', 'action', 'entry', 'problem'].includes(entity)) return NextResponse.json({ error: 'entity and id are required' }, { status: 400 })
  if (!['restore', 'permanent'].includes(operation)) return NextResponse.json({ error: 'invalid archive operation' }, { status: 400 })

  try {
    if (entity === 'goal') {
      if (operation === 'restore') await db.goal.update({ where: { id }, data: { status: 'active', archivedAt: null, deletedAt: null } })
      else await db.goal.delete({ where: { id } })
    } else if (entity === 'action') {
      if (operation === 'restore') await db.goalAction.update({ where: { id }, data: { status: 'backlog', archivedAt: null, deletedAt: null } })
      else await db.goalAction.delete({ where: { id } })
    } else if (entity === 'problem') {
      if (operation === 'restore') await db.goalProblem.update({ where: { id }, data: { archivedAt: null } })
      else await db.goalProblem.delete({ where: { id } })
    } else if (operation === 'restore') {
      await db.entry.update({ where: { id }, data: { deletedAt: null } })
    } else {
      await db.entry.delete({ where: { id } })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'record not found' }, { status: 404 })
  }
}
