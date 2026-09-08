'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Check, CirclePlus, Pause, Play, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useDepartments, useGoals, useSprints, store, type Goal } from '@/lib/hooks'
import { daysRemaining, goalProgress } from '@/lib/goal-metrics'
import { toKey, addDays } from '@/lib/dates'
import { useUIStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { SprintPanel } from '@/components/sprint-panel'
import { TodayScreen } from '@/components/screens/today-screen'
import { LedgerMeta, LedgerPanel, LedgerRow, LedgerSectionLabel } from '@/components/quiet-ledger'

export function GoalsScreen() {
  const { goals, loading } = useGoals()
  const { departments } = useDepartments()
  const { sprints } = useSprints()
  const activeGoalId = useUIStore((state) => state.activeGoalId)
  const openGoal = useUIStore((state) => state.openGoal)
  const closeGoal = useUIStore((state) => state.closeGoal)
  const activeGoal = goals.find((goal) => goal.id === activeGoalId)
  const visibleGoals = goals.filter((goal) => !['completed', 'abandoned'].includes(goal.status))
  const visibleSprints = sprints.filter((sprint) => sprint.status !== 'archived')
  const linkedGoalIds = new Set(visibleSprints.flatMap((sprint) => sprint.goals.map((link) => link.goalId)))
  const generalGoals = visibleGoals.filter((goal) => !linkedGoalIds.has(goal.id))

  useEffect(() => {
    if (activeGoalId) document.getElementById('outcome-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeGoalId])

  return (
    <div className="mx-auto max-w-5xl space-y-8 overflow-x-hidden pb-12">
      <header><h1 className="ledger-page-title">Work</h1></header>
      <TodayScreen />
      <SprintPanel />

      <section className="space-y-3" aria-labelledby="sprint-outcomes-heading">
        <div className="flex items-end justify-between gap-4"><LedgerSectionLabel id="sprint-outcomes-heading">Outcomes by Sprint</LedgerSectionLabel><span className="text-xs tabular-nums text-muted-foreground">{visibleSprints.length} Sprint{visibleSprints.length === 1 ? '' : 's'}</span></div>
        {loading ? <p className="py-6 text-sm text-muted-foreground">Loading outcomes…</p> : visibleSprints.length === 0 ? <EmptySprintState /> : visibleSprints.map((sprint) => <SprintOutcomeGroup key={sprint.id} sprint={sprint} onOpenGoal={openGoal} />)}
      </section>

      <section className="space-y-3" aria-labelledby="general-outcomes-heading">
        <div className="flex items-end justify-between gap-4"><LedgerSectionLabel id="general-outcomes-heading">Unassigned outcomes</LedgerSectionLabel><GeneralOutcomeDialog departments={departments} /></div>
        {loading ? <p className="py-6 text-sm text-muted-foreground">Loading…</p> : generalGoals.length === 0 ? <LedgerPanel className="border-dashed bg-transparent py-5"><p className="text-sm text-muted-foreground">None.</p></LedgerPanel> : <div className="flex flex-wrap gap-2">{generalGoals.map((goal) => <OutcomeButton key={goal.id} goal={goal} onClick={() => openGoal(goal.id)} />)}</div>}
      </section>

      {activeGoal && <section id="outcome-detail" className="scroll-mt-6 border-t border-border pt-8" aria-label="Outcome details"><GoalWorkbench goal={activeGoal} onBack={closeGoal} /></section>}
    </div>
  )
}

function EmptySprintState() {
  return <LedgerPanel className="border-dashed bg-transparent py-5"><p className="text-sm text-muted-foreground">No Sprints yet.</p></LedgerPanel>
}

function SprintOutcomeGroup({ sprint, onOpenGoal }: { sprint: ReturnType<typeof useSprints>['sprints'][number]; onOpenGoal: (id: string) => void }) {
  const current = sprint.status === 'active'
  return (
    <section className={cn('rounded-md border border-border bg-card/70 p-4', current && 'border-l-2 border-l-[var(--growth)]')}>
      <div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{sprint.name}</h3>{current && <span className="text-[11px] font-medium text-[var(--growth)]">Current</span>}</div><LedgerMeta className="mt-1">{sprint.phase || `${daysRemaining(sprint.endDate)}d remaining`} · {sprint.goals.length} outcome{sprint.goals.length === 1 ? '' : 's'}</LedgerMeta></div><span className="shrink-0 text-xs tabular-nums text-muted-foreground">{sprint.startDate} → {sprint.endDate}</span></div>
      {sprint.goals.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No outcomes yet.</p> : <div className="mt-4 flex flex-wrap gap-2">{sprint.goals.map((link) => <OutcomeButton key={link.goalId} goal={link.goal} onClick={() => onOpenGoal(link.goalId)} />)}</div>}
    </section>
  )
}

function GeneralOutcomeDialog({ departments }: { departments: ReturnType<typeof useDepartments>['departments'] }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [departmentId, setDepartmentId] = useState('')
  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState(toKey(addDays(new Date(), 17)))
  const today = toKey(new Date())
  const effectiveDepartmentId = departmentId || departments[0]?.id || ''

  async function create() {
    if (!effectiveDepartmentId || !title.trim() || busy) return
    setBusy(true)
    try {
      await store.createGoal({ departmentId: effectiveDepartmentId, title: title.trim(), outcome: title.trim(), startDate: today, targetDate, sprintId: null })
      setTitle(''); setOpen(false); toast.success('Outcome created')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create outcome') }
    finally { setBusy(false) }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm"><CirclePlus className="h-4 w-4" /> Add outcome</Button></DialogTrigger>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader><DialogTitle>Add an outcome</DialogTitle><DialogDescription>Leave it unassigned until you choose a Sprint.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="grid items-start gap-4 sm:grid-cols-2"><Field label="Area"><select value={effectiveDepartmentId} onChange={(event) => setDepartmentId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">Choose an area</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name.replace('Department of ', '')}</option>)}</select></Field><Field label="Due"><Input type="date" min={today} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></Field></div>
        <Field label="Outcome"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What result should exist?" /></Field>
        <div className="flex gap-2"><Button onClick={create} disabled={busy || !title.trim() || !effectiveDepartmentId}>Create outcome</Button><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
      </div>
    </DialogContent>
  </Dialog>
}

function OutcomeButton({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const progress = goalProgress(goal)
  const state = outcomeState(goal, progress)
  return <button type="button" onClick={onClick} title={`${goal.title} · ${deadlineLabel(daysRemaining(goal.targetDate))}`} className={cn('rounded-sm border px-3 py-2 text-left text-sm transition hover:-translate-y-px hover:border-foreground/35', state === 'positive' && 'border-[var(--growth)]/45 bg-[var(--growth)]/8', state === 'risk' && 'border-[var(--depreciation)]/45 bg-[var(--depreciation)]/8', state === 'neutral' && 'border-border bg-background/30')}><span className="font-medium">{goal.title}</span><span className={cn('ml-2 tabular-nums', state === 'positive' ? 'text-[var(--growth)]' : state === 'risk' ? 'text-[var(--depreciation)]' : 'text-muted-foreground')}>{Math.round(progress * 100)}%</span></button>
}

function GoalWorkbench({ goal, onBack }: { goal: Goal; onBack: () => void }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(goal.title)
  const [details, setDetails] = useState(goal.outcome === goal.title ? '' : goal.outcome)
  const progress = goalProgress(goal)

  async function save() {
    try {
      await store.updateGoal(goal.id, { title: title.trim() || goal.title, outcome: details.trim() || title.trim() || goal.title })
      setEditing(false)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save outcome') }
  }

  return <div className="mx-auto max-w-4xl space-y-6">
    <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-[var(--growth)]">Outcome</p><Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back to Work</Button></div>
    <section className="rounded-md border border-border bg-card p-5 md:p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{goal.department.name.replace('Department of ', '')}</p>
          {editing ? <div className="mt-2 space-y-3"><Field label="Outcome"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Field><details className="rounded-sm border border-border/70 px-3 py-2"><summary className="cursor-pointer text-xs font-medium text-muted-foreground">Details (optional)</summary><Textarea className="mt-3" value={details} onChange={(event) => setDetails(event.target.value)} rows={2} placeholder="Anything else to keep in mind" /></details><div className="flex gap-2"><Button size="sm" onClick={save}>Save changes</Button><Button size="sm" variant="ghost" onClick={() => { setTitle(goal.title); setDetails(goal.outcome === goal.title ? '' : goal.outcome); setEditing(false) }}>Cancel</Button></div></div> : <><h2 className="ledger-page-title mt-1 text-3xl">{goal.title}</h2>{goal.outcome !== goal.title && <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{goal.outcome}</p>}</>}
        </div>
        <div className="text-right"><p className="ledger-metric text-5xl text-[var(--growth)]">{Math.round(progress * 100)}%</p><p className="text-xs text-muted-foreground">{deadlineLabel(daysRemaining(goal.targetDate))}</p></div>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-[var(--growth)] transition-all" style={{ width: `${progress * 100}%` }} /></div>
      <div className="mt-4 flex flex-wrap gap-2">{goal.status === 'active' ? <Button variant="outline" size="sm" onClick={() => store.updateGoal(goal.id, { status: 'paused' })}><Pause className="h-3.5 w-3.5" /> Put on hold</Button> : <Button variant="outline" size="sm" onClick={() => store.updateGoal(goal.id, { status: 'active' })}><Play className="h-3.5 w-3.5" /> Resume</Button>}<Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>{goal.status !== 'completed' && <Button variant="ghost" size="sm" onClick={() => store.updateGoal(goal.id, { status: 'completed' })}><Check className="h-3.5 w-3.5" /> Mark complete</Button>}</div>
    </section>
    <OutcomeStructure goal={goal} />
    <section className="space-y-3"><LedgerSectionLabel>Steps</LedgerSectionLabel><ActionsPanel goal={goal} /></section>
  </div>
}

function OutcomeStructure({ goal }: { goal: Goal }) {
  const [open, setOpen] = useState(goal.targets.length > 0 || goal.problems.length > 0)
  const [measureLabel, setMeasureLabel] = useState('')
  const [measureValue, setMeasureValue] = useState('1')
  const [measureUnit, setMeasureUnit] = useState('outputs')
  const [blocker, setBlocker] = useState('')
  const [busy, setBusy] = useState(false)

  async function addMeasure() {
    if (busy || !measureLabel.trim() || Number(measureValue) <= 0) return
    setBusy(true)
    try {
      await store.addGoalTarget({ goalId: goal.id, label: measureLabel.trim(), unit: measureUnit.trim() || 'outputs', targetValue: Number(measureValue), progressSource: 'manual' })
      setMeasureLabel(''); setMeasureValue('1'); toast.success('Measure added')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add measure') }
    finally { setBusy(false) }
  }

  async function addBlocker() {
    if (busy || !blocker.trim()) return
    setBusy(true)
    try {
      await store.addGoalProblem({ goalId: goal.id, statement: blocker.trim() })
      setBlocker(''); toast.success('Blocker added')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add blocker') }
    finally { setBusy(false) }
  }

  return <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="rounded-md border border-border bg-card/45">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium"><span>Measures and blockers <span className="ml-1 text-xs font-normal text-muted-foreground">optional</span></span><span className="text-xs text-muted-foreground">{goal.targets.length + goal.problems.length || 'None'}</span></summary>
    <div className="border-t border-border/70 px-4 py-4"><p className="text-xs text-muted-foreground">Use a measure when the outcome needs a number. Add a blocker only when something is in the way.</p><div className="mt-4 grid gap-4 md:grid-cols-2">
      <div className="space-y-3"><div><LedgerSectionLabel>Measures</LedgerSectionLabel><LedgerMeta className="mt-1">A number this outcome should move.</LedgerMeta></div>{goal.targets.map((target) => <LedgerRow key={target.id} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0 truncate text-sm">{target.label}</span><span className="shrink-0 text-xs tabular-nums text-muted-foreground">{target.currentValue}/{target.targetValue} {target.unit}</span></LedgerRow>)}<div className="grid grid-cols-[1fr_72px] gap-2"><Input value={measureLabel} onChange={(event) => setMeasureLabel(event.target.value)} placeholder="What will move?" /><Input type="number" min={1} value={measureValue} onChange={(event) => setMeasureValue(event.target.value)} aria-label="Measure value" /></div><div className="flex gap-2"><Input value={measureUnit} onChange={(event) => setMeasureUnit(event.target.value)} placeholder="Unit" /><Button size="sm" variant="outline" onClick={addMeasure} disabled={busy || !measureLabel.trim()}>Add measure</Button></div></div>
      <div className="space-y-3"><div><LedgerSectionLabel>Blockers</LedgerSectionLabel><LedgerMeta className="mt-1">A real obstacle to resolve.</LedgerMeta></div>{goal.problems.map((problem) => <LedgerRow key={problem.id} className="flex items-center justify-between gap-3 py-2"><span className={cn('min-w-0 truncate text-sm', problem.status === 'solved' && 'text-muted-foreground line-through')}>{problem.statement}</span><Button size="sm" variant="ghost" onClick={() => store.updateGoalProblem(problem.id, { status: problem.status === 'solved' ? 'open' : 'solved' }).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not update blocker'))}>{problem.status === 'solved' ? 'Reopen' : 'Resolve'}</Button></LedgerRow>)}<div className="flex gap-2"><Input value={blocker} onChange={(event) => setBlocker(event.target.value)} placeholder="What is in the way?" /><Button size="sm" variant="outline" onClick={addBlocker} disabled={busy || !blocker.trim()}>Add blocker</Button></div></div>
    </div></div>
  </details>
}

function ActionsPanel({ goal }: { goal: Goal }) {
  const { goals } = useGoals()
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState('45')
  const [dueDate, setDueDate] = useState(toKey(new Date()))
  const [subdepartmentId, setSubdepartmentId] = useState(goal.department.subdepartments[0]?.id ?? '')
  const [targetId, setTargetId] = useState('')
  const [problemId, setProblemId] = useState('')
  const [planToday, setPlanToday] = useState(true)
  const [busy, setBusy] = useState(false)
  const plannedCount = goals.flatMap((item) => item.actions).filter((action) => action.status === 'today' || action.status === 'in_progress').length
  const queueFull = planToday && plannedCount >= 3
  const hasStructure = goal.targets.length > 0 || goal.problems.length > 0

  async function add() {
    if (busy || !title.trim() || Number(minutes) <= 0) return
    setBusy(true)
    try {
      await store.addGoalAction({ goalId: goal.id, title: title.trim(), definitionOfDone: null, plannedMinutes: Number(minutes), context: 'focused', dueDate: dueDate || null, subdepartmentId: subdepartmentId || null, targetId: targetId || null, problemId: problemId || null, status: planToday ? 'today' : 'backlog' })
      setTitle(''); toast.success(planToday ? "Step added to today's queue" : 'Step saved to backlog')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add step') }
    finally { setBusy(false) }
  }

  async function updateStatus(id: string, status: 'today' | 'backlog') {
    try { await store.updateGoalAction(id, { status }); toast.success(status === 'today' ? 'Step planned for today' : 'Step moved to backlog') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update step') }
  }

  const actions = [...goal.actions].sort((a, b) => statusOrder(a.status) - statusOrder(b.status))
  return <div className="space-y-3">
    {actions.filter((action) => action.status !== 'cancelled').map((action) => <LedgerRow key={action.id} className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className={cn('text-sm font-medium leading-5', action.status === 'completed' && 'text-muted-foreground line-through')}>{action.title}</p><LedgerMeta className="mt-1 truncate">{action.plannedMinutes}m{action.dueDate ? ` · ${action.dueDate}` : ''} · {actionStatusLabel(action.status)}</LedgerMeta>{action.definitionOfDone && <p className="mt-2 text-sm text-muted-foreground">{action.definitionOfDone}</p>}</div><div className="flex shrink-0 gap-1">{action.status === 'backlog' && <Button size="sm" variant="outline" onClick={() => updateStatus(action.id, 'today')}>Plan for today</Button>}{action.status === 'today' && <Button size="sm" variant="ghost" onClick={() => updateStatus(action.id, 'backlog')}>Move to backlog</Button>}{!['completed', 'cancelled'].includes(action.status) && <Button size="sm" variant="ghost" onClick={() => store.updateGoalAction(action.id, { status: 'cancelled' }).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not archive step'))}>Archive</Button>}</div></LedgerRow>)}
    <LedgerPanel className="p-4">
      <LedgerSectionLabel>Add a step</LedgerSectionLabel>
      <div className="mt-4 space-y-4">
        <div className="grid items-start gap-4 sm:grid-cols-[1fr_110px]"><Field label="Step"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Concrete work to do" /></Field><Field label="Minutes"><Input type="number" min={1} max={720} value={minutes} onChange={(event) => setMinutes(event.target.value)} /></Field></div>
        <div className="grid items-start gap-4 sm:grid-cols-2"><Field label="Area"><select value={subdepartmentId} onChange={(event) => setSubdepartmentId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">No category</option>{goal.department.subdepartments.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}</select></Field><Field label="Due"><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field></div>
        {hasStructure && <div className="grid items-start gap-4 rounded-sm border border-border/70 bg-background/20 p-3 sm:grid-cols-2"><Field label="Measure"><select value={targetId} onChange={(event) => setTargetId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">No measure</option>{goal.targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select></Field><Field label="Blocker"><select value={problemId} onChange={(event) => setProblemId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">No blocker</option>{goal.problems.map((problem) => <option key={problem.id} value={problem.id}>{problem.statement}</option>)}</select></Field></div>}
        <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={planToday} onChange={(event) => setPlanToday(event.target.checked)} />Plan for today</label>{queueFull && <p className="text-xs text-muted-foreground">Three daily slots are full. Save this step to backlog.</p>}</div>
        <Button onClick={add} disabled={busy || !title.trim() || Number(minutes) <= 0 || queueFull}><Plus className="h-4 w-4" /> Add step</Button>
      </div>
    </LedgerPanel>
  </div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

function outcomeState(goal: Goal, progress: number): 'positive' | 'risk' | 'neutral' {
  if (progress >= 1) return 'positive'
  const remaining = daysRemaining(goal.targetDate)
  if (remaining < 0) return 'risk'
  if (progress === 0) return 'neutral'
  const start = new Date(`${goal.startDate}T00:00:00`).getTime()
  const end = new Date(`${goal.targetDate}T00:00:00`).getTime()
  const expected = Math.max(0, Math.min(1, (Date.now() - start) / Math.max(1, end - start)))
  return progress + 0.12 < expected ? 'risk' : 'positive'
}

function deadlineLabel(days: number) { return days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'due today' : `${days}d remaining` }
function actionStatusLabel(status: string) { return status === 'today' ? 'Planned for today' : status === 'in_progress' ? 'In focus' : status === 'completed' ? 'Finished' : 'Backlog' }
function statusOrder(status: string) { return status === 'in_progress' ? 0 : status === 'today' ? 1 : status === 'backlog' ? 2 : 3 }
