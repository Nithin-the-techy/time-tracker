import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEPARTMENT_MODULES, type DepartmentModuleKey } from '@/lib/department-modules'
import type { GoalTarget } from '@prisma/client'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const VALID_STATUSES = new Set(['draft', 'active', 'paused', 'completed', 'abandoned'])

const goalInclude = {
  department: { include: { subdepartments: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } } } },
  targets: { include: { subdepartment: true }, orderBy: { sortOrder: 'asc' as const } },
  problems: { orderBy: [{ status: 'asc' as const }, { severity: 'asc' as const }] },
  actions: {
    include: { target: true, problem: true, subdepartment: true, sessions: { orderBy: { startedAt: 'desc' as const } } },
    orderBy: [{ status: 'asc' as const }, { todayOrder: 'asc' as const }, { createdAt: 'asc' as const }],
  },
}

export async function GET() {
  const goals = await db.goal.findMany({
    include: goalInclude,
    orderBy: [{ status: 'asc' }, { priority: 'asc' }, { targetDate: 'asc' }],
  })
  return NextResponse.json({ goals })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body.template === 'exam-sprint') return createExamSprint(body)

  const departmentId = String(body.departmentId ?? '')
  const title = String(body.title ?? '').trim().slice(0, 160)
  const outcome = String(body.outcome ?? '').trim().slice(0, 1000)
  const startDate = String(body.startDate ?? '')
  const targetDate = String(body.targetDate ?? '')
  const priority = Math.min(5, Math.max(1, Math.round(Number(body.priority ?? 3))))
  const status = String(body.status ?? 'active')

  if (!departmentId || !title || !outcome || !DATE_KEY.test(startDate) || !DATE_KEY.test(targetDate)) {
    return NextResponse.json({ error: 'department, title, outcome, and valid dates are required' }, { status: 400 })
  }
  if (targetDate < startDate) return NextResponse.json({ error: 'target date must be on or after start date' }, { status: 400 })
  if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: 'invalid goal status' }, { status: 400 })

  const department = await db.department.findUnique({ where: { id: departmentId } })
  if (!department) return NextResponse.json({ error: 'department not found' }, { status: 400 })
  const requestedModule = String(body.moduleKey ?? department.moduleKey) as DepartmentModuleKey
  const moduleKey = DEPARTMENT_MODULES[requestedModule] ? requestedModule : 'generic'

  const goal = await db.goal.create({
    data: {
      departmentId,
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
    },
    include: goalInclude,
  })
  return NextResponse.json({ goal })
}

async function createExamSprint(body: Record<string, unknown>) {
  const education = await db.department.findUnique({
    where: { slug: 'education' },
    include: { subdepartments: true },
  })
  if (!education) return NextResponse.json({ error: 'Education department not found' }, { status: 400 })

  const existing = await db.goal.findFirst({ where: { title: 'Exam sprint — sustained execution', status: { in: ['draft', 'active', 'paused'] } } })
  if (existing) return NextResponse.json({ error: 'An active exam sprint already exists' }, { status: 409 })

  const today = dateKey(new Date())
  const startDate = typeof body.startDate === 'string' && DATE_KEY.test(body.startDate) ? body.startDate : today
  const targetDate = typeof body.targetDate === 'string' && DATE_KEY.test(body.targetDate)
    ? body.targetDate
    : addCalendarDays(startDate, 17)

  const subjectPlans = [
    ['Physics', 870],
    ['Chemistry', 660],
    ['Math', 660],
    ['English', 660],
    ['CS', 300],
  ] as const
  const subByName = new Map(education.subdepartments.map((s) => [s.name.toLowerCase(), s]))

  const goal = await db.$transaction(async (tx) => {
    const created = await tx.goal.create({
      data: {
        departmentId: education.id,
        title: 'Exam sprint — sustained execution',
        outcome: 'Complete the planned revision effort honestly and produce evidence each day; marks are an outcome, not the definition of discipline.',
        whyNow: 'Predicted grades and teacher trust depend on these exams. This is a test of sustained execution, not personal worth.',
        constraints: 'Annual-day practice creates an interruptible-work window. Deep study stays outside that distracting context.',
        moduleKey: 'education',
        status: 'active',
        priority: 1,
        startDate,
        targetDate,
        reviewCadence: 'daily',
      },
    })

    const targets: GoalTarget[] = []
    for (let index = 0; index < subjectPlans.length; index++) {
      const [label, targetValue] = subjectPlans[index]
      const sub = subByName.get(label.toLowerCase())
        ?? (label === 'CS' ? subByName.get('computer science') : undefined)
      targets.push(await tx.goalTarget.create({
        data: {
          goalId: created.id,
          subdepartmentId: sub?.id,
          label,
          unit: 'minutes',
          targetValue,
          progressSource: 'productive_minutes',
          weight: targetValue,
          sortOrder: index,
        },
      }))
    }

    const starterActions = [
      { target: 'Physics', title: 'Run a Theme E diagnostic and make a correction list', minutes: 60, context: 'deep study', done: 'Diagnostic attempted and an explicit correction list exists' },
      { target: 'English', title: 'Write one timed analysis paragraph and critique it', minutes: 45, context: 'writing', done: 'Paragraph plus a short list of weaknesses and the rewrite rule' },
      { target: 'Math', title: 'Attempt a mixed problem set and classify every error', minutes: 60, context: 'deep study', done: 'Problems attempted and errors classified by concept' },
    ]
    for (let index = 0; index < starterActions.length; index++) {
      const a = starterActions[index]
      const target = targets.find((t) => t.label === a.target)!
      await tx.goalAction.create({
        data: {
          goalId: created.id,
          targetId: target.id,
          subdepartmentId: target.subdepartmentId,
          title: a.title,
          plannedMinutes: a.minutes,
          context: a.context,
          status: 'today',
          todayOrder: index,
          definitionOfDone: a.done,
          dueDate: startDate,
        },
      })
    }
    return created
  })

  const hydrated = await db.goal.findUnique({ where: { id: goal.id }, include: goalInclude })
  return NextResponse.json({ goal: hydrated })
}

function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addCalendarDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}
