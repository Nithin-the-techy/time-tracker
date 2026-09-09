import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEPARTMENT_MODULES, type DepartmentModuleKey } from '@/lib/department-modules'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const VALID_STATUSES = new Set(['draft', 'active', 'paused', 'completed', 'abandoned', 'archived'])

const goalInclude = {
  department: { include: { subdepartments: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } } } },
  departments: { include: { department: { include: { subdepartments: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } } } } }, orderBy: { sortOrder: 'asc' as const } },
  targets: { include: { subdepartment: true }, orderBy: { sortOrder: 'asc' as const } },
  problems: { where: { archivedAt: null }, orderBy: [{ status: 'asc' as const }, { severity: 'asc' as const }] },
  actions: {
    where: { deletedAt: null },
    include: { target: true, problem: true, subdepartment: true, sessions: { orderBy: { startedAt: 'desc' as const } } },
    orderBy: [{ status: 'asc' as const }, { todayOrder: 'asc' as const }, { createdAt: 'asc' as const }],
  },
}

export async function GET() {
  const goals = await db.goal.findMany({
    where: { deletedAt: null },
    include: goalInclude,
    orderBy: [{ status: 'asc' }, { priority: 'asc' }, { targetDate: 'asc' }],
  })
  const targetIds = new Set(goals.flatMap((goal) => goal.targets.map((target) => target.id)))
  const productiveMinutes = new Map<string, number>()
  const goalMinutes = new Map<string, number>()
  const linkedEntries = await db.entry.findMany({
    where: { deletedAt: null, session: { isNot: null } },
    select: { durationMinutes: true, session: { select: { action: { select: { goalId: true, targetId: true } } } } },
  })
  for (const entry of linkedEntries) {
    const action = entry.session?.action
    if (action) goalMinutes.set(action.goalId, (goalMinutes.get(action.goalId) ?? 0) + entry.durationMinutes)
    const targetId = action?.targetId
    if (targetId && targetIds.has(targetId)) productiveMinutes.set(targetId, (productiveMinutes.get(targetId) ?? 0) + entry.durationMinutes)
  }
  const refreshedGoals = goals.map((goal) => ({
    ...goal,
    departmentIds: goal.departments.map((membership) => membership.departmentId),
    targets: goal.targets.map((target) => {
      const hasLinkedSteps = goal.actions.some((action) => action.targetId === target.id)
      const progressValue = target.progressSource === 'productive_minutes'
        ? hasLinkedSteps ? productiveMinutes.get(target.id) ?? 0 : goalMinutes.get(goal.id) ?? 0
        : target.progressSource === 'completed_actions'
          ? goal.actions.filter((action) => action.targetId === target.id && action.status === 'completed').length
          : target.progressSource === 'outputs'
            ? goal.actions.filter((action) => action.targetId === target.id && action.status === 'completed' && Boolean(action.output?.trim())).length
            : target.currentValue
      return { ...target, currentValue: progressValue, progressValue, progressRatio: target.targetValue > 0 ? Math.min(1, Math.max(0, progressValue / target.targetValue)) : 0 }
    }),
  }))
  return NextResponse.json({ goals: refreshedGoals })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, any>
  const requestedDepartmentIds: string[] = Array.isArray(body.departmentIds)
    ? body.departmentIds.map((id: unknown) => String(id)).filter(Boolean)
    : [String(body.departmentId ?? '')].filter(Boolean)
  const departmentIds: string[] = [...new Set(requestedDepartmentIds)]
  const title = String(body.title ?? '').trim().slice(0, 160)
  const outcome = String(body.outcome ?? '').trim().slice(0, 1000)
  const startDate = String(body.startDate ?? '')
  const targetDate = String(body.targetDate ?? '')
  const priority = Math.min(5, Math.max(1, Math.round(Number(body.priority ?? 3))))
  const status = String(body.status ?? 'active')
  const sprintId = body.sprintId ? String(body.sprintId) : null

  if (departmentIds.length < 1 || !title || !outcome || !DATE_KEY.test(startDate) || !DATE_KEY.test(targetDate)) {
    return NextResponse.json({ error: 'at least one Area, title, outcome, and valid dates are required' }, { status: 400 })
  }
  if (targetDate < startDate) return NextResponse.json({ error: 'target date must be on or after start date' }, { status: 400 })
  if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: 'invalid goal status' }, { status: 400 })

  const departments = await db.department.findMany({ where: { id: { in: departmentIds } } })
  if (departments.length !== departmentIds.length) return NextResponse.json({ error: 'one or more Areas not found' }, { status: 400 })
  if (sprintId) {
    const sprint = await db.sprint.findUnique({ where: { id: sprintId } })
    if (!sprint || sprint.status === 'archived') return NextResponse.json({ error: 'sprint not found' }, { status: 400 })
  }
  const requestedModule = String(body.moduleKey ?? departments[0].moduleKey) as DepartmentModuleKey
  const moduleKey = DEPARTMENT_MODULES[requestedModule] ? requestedModule : 'generic'

  const goal = await db.goal.create({
    data: {
      departmentId: departmentIds[0],
      title,
      outcome,
      moduleKey,
      startDate,
      targetDate,
      priority,
      status,
      whyNow: body.whyNow ? String(body.whyNow).slice(0, 1000) : null,
      constraints: body.constraints ? String(body.constraints).slice(0, 1000) : null,
      reviewCadence: String(body.reviewCadence ?? 'weekly').slice(0, 40),
      sprintLinks: sprintId ? { create: { sprintId } } : undefined,
      departments: { create: departmentIds.map((departmentId, sortOrder) => ({ departmentId, sortOrder })) },
    },
    include: goalInclude,
  })
  return NextResponse.json({ goal })
}
