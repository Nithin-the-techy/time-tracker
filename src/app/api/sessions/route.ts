import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { wouldExceedDay, workspaceTimeZone } from '@/lib/time-validation'
import { dateKeyInTimeZone } from '@/lib/dates'

type SessionDisposition =
  | 'complete_step'
  | 'stop_keep_today'
  | 'stop_to_backlog'
  | 'interrupted_keep_today'
  | 'interrupted_to_backlog'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const operation = String(body.operation ?? '')
  if (operation === 'start') return startSession(String(body.actionId ?? ''))
  if (operation === 'finish') return finishSession(body)
  return NextResponse.json({ error: 'operation must be start or finish' }, { status: 400 })
}

async function startSession(actionId: string) {
  if (!actionId) return NextResponse.json({ error: 'step required' }, { status: 400 })
  const running = await db.workSession.findFirst({ where: { status: 'running' } })
  if (running) return NextResponse.json({ error: 'A Session is already running', sessionId: running.id }, { status: 409 })
  const action = await db.goalAction.findFirst({ where: { id: actionId, deletedAt: null } })
  if (!action || ['completed', 'cancelled'].includes(action.status)) {
    return NextResponse.json({ error: 'Step cannot be started' }, { status: 400 })
  }
  const session = await db.$transaction(async (tx) => {
    await tx.goalAction.update({ where: { id: actionId }, data: { status: 'in_progress' } })
    return tx.workSession.create({ data: { actionId, status: 'running' } })
  })
  return NextResponse.json({ session })
}

function normalizeOutcome(body: Record<string, unknown>): { status: 'completed' | 'interrupted' | 'abandoned'; disposition: SessionDisposition } {
  const disposition = String(body.disposition ?? '') as SessionDisposition
  if (disposition === 'complete_step') return { status: 'completed', disposition }
  if (disposition === 'stop_to_backlog' || disposition === 'interrupted_to_backlog') return { status: 'abandoned', disposition }
  if (disposition === 'stop_keep_today' || disposition === 'interrupted_keep_today') return { status: 'interrupted', disposition }
  const outcome = String(body.outcome ?? 'completed')
  if (outcome === 'abandoned') return { status: 'abandoned', disposition: 'stop_to_backlog' }
  if (outcome === 'interrupted') return { status: 'interrupted', disposition: 'interrupted_keep_today' }
  return { status: 'completed', disposition: 'complete_step' }
}

async function finishSession(body: Record<string, unknown>) {
  const sessionId = String(body.sessionId ?? '')
  const actualMinutes = Math.round(Number(body.actualMinutes ?? 0))
  const { status: outcome } = normalizeOutcome(body)
  const outputValue = body.resultNote ?? body.output
  const output = outputValue ? String(outputValue).trim().slice(0, 2000) : null
  const friction = body.friction ? String(body.friction).trim().slice(0, 1000) : null
  if (!sessionId || actualMinutes < 1 || actualMinutes > 720) {
    return NextResponse.json({ error: 'session and actual minutes (1–720) are required' }, { status: 400 })
  }

  const session = await db.workSession.findUnique({
    where: { id: sessionId },
    include: { action: { include: { goal: true, target: true } } },
  })
  if (!session || session.status !== 'running') return NextResponse.json({ error: 'running Session not found' }, { status: 404 })

  const timeZone = await workspaceTimeZone()
  const sessionDate = dateKeyInTimeZone(session.startedAt, timeZone)
  if (outcome !== 'abandoned' && await wouldExceedDay(sessionDate, actualMinutes, timeZone)) {
    return NextResponse.json({ error: 'This Session would put the day above 24 hours' }, { status: 409 })
  }

  const result = await db.$transaction(async (tx) => {
    let entryId: string | null = null
    if (outcome !== 'abandoned') {
      const entry = await tx.entry.create({
        data: {
          departmentId: session.action.goal.departmentId,
          subdepartmentId: session.action.subdepartmentId,
          entryTimestamp: session.startedAt,
          durationMinutes: actualMinutes,
          note: output,
        },
      })
      entryId = entry.id
    }

    const updated = await tx.workSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date(), status: outcome, actualMinutes, output, friction, entryId },
    })
    await tx.goalAction.update({
      where: { id: session.actionId },
      data: {
        status: outcome === 'completed' ? 'completed' : outcome === 'interrupted' ? 'today' : 'backlog',
        todayOrder: outcome === 'completed' || outcome === 'abandoned' ? null : session.action.todayOrder,
        output,
      },
    })
    return updated
  })
  return NextResponse.json({ session: result })
}
