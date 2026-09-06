import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { wouldExceedDay } from '@/lib/time-validation'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const operation = String(body.operation ?? '')
  if (operation === 'start') return startSession(String(body.actionId ?? ''))
  if (operation === 'finish') return finishSession(body)
  return NextResponse.json({ error: 'operation must be start or finish' }, { status: 400 })
}

async function startSession(actionId: string) {
  if (!actionId) return NextResponse.json({ error: 'actionId required' }, { status: 400 })
  const running = await db.focusSession.findFirst({ where: { status: 'running' } })
  if (running) return NextResponse.json({ error: 'A focus session is already running' }, { status: 409 })
  const action = await db.goalAction.findUnique({ where: { id: actionId } })
  if (!action || ['completed', 'cancelled'].includes(action.status)) {
    return NextResponse.json({ error: 'action cannot be started' }, { status: 400 })
  }
  const session = await db.$transaction(async (tx) => {
    await tx.goalAction.update({ where: { id: actionId }, data: { status: 'in_progress' } })
    return tx.focusSession.create({ data: { actionId, status: 'running' } })
  })
  return NextResponse.json({ session })
}

async function finishSession(body: Record<string, unknown>) {
  const sessionId = String(body.sessionId ?? '')
  const actualMinutes = Math.round(Number(body.actualMinutes ?? 0))
  const outcome = String(body.outcome ?? 'completed')
  const output = body.output ? String(body.output).trim().slice(0, 2000) : null
  const friction = body.friction ? String(body.friction).trim().slice(0, 1000) : null
  if (!sessionId || actualMinutes < 1 || actualMinutes > 720) {
    return NextResponse.json({ error: 'session and actual minutes (1–720) are required' }, { status: 400 })
  }
  if (!['completed', 'interrupted', 'abandoned'].includes(outcome)) {
    return NextResponse.json({ error: 'invalid session outcome' }, { status: 400 })
  }
  if (outcome === 'completed' && !output) {
    return NextResponse.json({ error: 'Describe the output or evidence before completing' }, { status: 400 })
  }

  const session = await db.focusSession.findUnique({
    where: { id: sessionId },
    include: { action: { include: { goal: true, target: true } } },
  })
  if (!session || session.status !== 'running') return NextResponse.json({ error: 'running session not found' }, { status: 404 })

  const sessionDate = session.startedAt.toISOString().slice(0, 10)
  if (outcome !== 'abandoned' && session.action.subdepartmentId && await wouldExceedDay(sessionDate, actualMinutes)) {
    return NextResponse.json({ error: 'This session would put the day above 24 hours' }, { status: 409 })
  }

  const result = await db.$transaction(async (tx) => {
    let entryId: string | null = null
    if (outcome !== 'abandoned' && session.action.subdepartmentId) {
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

    const updated = await tx.focusSession.update({
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
    if (outcome !== 'abandoned' && session.action.target?.progressSource === 'productive_minutes') {
      await tx.goalTarget.update({
        where: { id: session.action.target.id },
        data: { currentValue: { increment: actualMinutes } },
      })
    }
    return updated
  })
  return NextResponse.json({ session: result })
}
