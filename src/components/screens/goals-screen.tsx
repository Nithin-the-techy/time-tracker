'use client'

import { useEffect, useState } from 'react'
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
      <header className="max-w-3xl">
        <p className="text-sm text-[var(--growth)]">Execution</p>
        <h1 className="ledger-page-title mt-1">Work</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Plan a small amount, start one focus block, and leave a useful record. Backlog work stays out of today until you choose it.</p>
      </header>

      <TodayScreen />
      <SprintPanel />

      <section className="space-y-3" aria-labelledby="sprint-outcomes-heading">
        <div className="flex items-end justify-between gap-4">
          <div><LedgerSectionLabel id="sprint-outcomes-heading">Outcomes by Sprint</LedgerSectionLabel><LedgerMeta className="mt-1">Outcomes live under the window they support.</LedgerMeta></div>
          <span className="text-xs tabular-nums text-muted-foreground">{visibleSprints.length} window{visibleSprints.length === 1 ? '' : 's'}</span>
        </div>
        {loading ? <p className="py-6 text-sm text-muted-foreground">Loading outcomes…</p> : visibleSprints.length === 0 ? <EmptySprintState /> : visibleSprints.map((sprint) => <SprintOutcomeGroup key={sprint.id} sprint={sprint} onOpenGoal={openGoal} />)}
      </section>

      <section className="space-y-3" aria-labelledby="general-outcomes-heading">
        <div className="flex items-end justify-between gap-4">
          <div><LedgerSectionLabel id="general-outcomes-heading">General outcomes</LedgerSectionLabel><LedgerMeta className="mt-1">Useful work that is not attached to a Sprint yet.</LedgerMeta></div>
          <GeneralOutcomeDialog departments={departments} />
        </div>
        {loading ? <p className="py-6 text-sm text-muted-foreground">Loading outcomes…</p> : generalGoals.length === 0 ? <LedgerPanel className="border-dashed bg-transparent py-5"><p className="text-sm text-muted-foreground">No general outcomes. Add one here when it does not belong to a Sprint.</p></LedgerPanel> : <div className="flex flex-wrap gap-2">{generalGoals.map((goal) => <OutcomeButton key={goal.id} goal={goal} onClick={() => openGoal(goal.id)} />)}</div>}
      </section>

      {activeGoal && <section id="outcome-detail" className="scroll-mt-6 border-t border-border pt-8" aria-label="Outcome details"><GoalWorkbench goal={activeGoal} onBack={closeGoal} /></section>}
    </div>
  )
}

function EmptySprintState() {
  return <LedgerPanel className="border-dashed bg-transparent py-5"><p className="text-sm text-muted-foreground">No Sprint yet. Add one above when you are ready to define an execution window.</p></LedgerPanel>
}

function SprintOutcomeGroup({ sprint, onOpenGoal }: { sprint: ReturnType<typeof useSprints>['sprints'][number]; onOpenGoal: (id: string) => void }) {
  return (
    <section className={cn('rounded-lg border p-4', sprint.status === 'active' ? 'border-[var(--growth)]/35 bg-[var(--growth)]/[0.04]' : 'border-border bg-card/30')}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{sprint.name}</h3><span className="rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">{sprintStatusLabel(sprint.status)}</span></div><LedgerMeta className="mt-1">{sprint.phase || `${daysRemaining(sprint.endDate)}d remaining`} · {sprint.goals.length} outcome{sprint.goals.length === 1 ? '' : 's'}</LedgerMeta></div>
        <span className="text-xs tabular-nums text-muted-foreground">{sprint.startDate} → {sprint.endDate}</span>
      </div>
      {sprint.goals.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No outcomes attached. Open Sprint settings above to add or move one here.</p> : <div className="mt-4 flex flex-wrap gap-2">{sprint.goals.map((link) => <OutcomeButton key={link.goalId} goal={link.goal} onClick={() => onOpenGoal(link.goalId)} />)}</div>}
    </section>
  )
}

function GeneralOutcomeDialog({ departments }: { departments: ReturnType<typeof useDepartments>['departments'] }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [departmentId, setDepartmentId] = useState('')
  const [title, setTitle] = useState('')
  const [outcome, setOutcome] = useState('')
  const [targetDate, setTargetDate] = useState(toKey(addDays(new Date(), 17)))
  const today = toKey(new Date())
  const effectiveDepartmentId = departmentId || departments[0]?.id || ''

  async function create() {
    if (!effectiveDepartmentId || !title.trim() || !outcome.trim() || busy) return
    setBusy(true)
    try {
      await store.createGoal({ departmentId: effectiveDepartmentId, title: title.trim(), outcome: outcome.trim(), startDate: today, targetDate, sprintId: null })
      setTitle(''); setOutcome(''); setOpen(false); toast.success('General outcome added')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add outcome') }
    finally { setBusy(false) }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm"><CirclePlus className="h-4 w-4" /> Add general outcome</Button></DialogTrigger>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader><DialogTitle>Add a general outcome</DialogTitle><DialogDescription>This stays outside Sprints until you move it into one.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><div><Label>Area</Label><select value={effectiveDepartmentId} onChange={(event) => setDepartmentId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{departments.map((department) => <option key={department.id} value={department.id}>{department.name.replace('Department of ', '')}</option>)}</select></div><div><Label>Due</Label><Input type="date" min={today} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></div></div>
        <div><Label>Outcome</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A result worth tracking" /></div>
        <div><Label>Finished when</Label><Textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} rows={3} placeholder="What result would make this complete?" /></div>
        <div className="flex gap-2"><Button onClick={create} disabled={busy || !title.trim() || !outcome.trim()}>Add outcome</Button><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
      </div>
    </DialogContent>
  </Dialog>
}

function OutcomeButton({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const progress = goalProgress(goal)
  const state = outcomeState(goal, progress)
  return <button type="button" onClick={onClick} title={`${goal.title} · ${deadlineLabel(daysRemaining(goal.targetDate))}`} className={cn('rounded-md border px-3 py-2 text-left text-sm transition hover:-translate-y-px hover:border-foreground/35', state === 'positive' && 'border-[var(--growth)]/45 bg-[var(--growth)]/8', state === 'risk' && 'border-[var(--depreciation)]/45 bg-[var(--depreciation)]/8', state === 'neutral' && 'border-border bg-muted/20')}><span className="font-medium">{goal.title}</span><span className={cn('ml-2 tabular-nums', state === 'positive' ? 'text-[var(--growth)]' : state === 'risk' ? 'text-[var(--depreciation)]' : 'text-muted-foreground')}>{Math.round(progress * 100)}%</span></button>
}

function GoalWorkbench({ goal, onBack }: { goal: Goal; onBack: () => void }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(goal.title)
  const [outcome, setOutcome] = useState(goal.outcome)
  const progress = goalProgress(goal)

  return <div className="mx-auto max-w-4xl space-y-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-[var(--growth)]">Outcome detail</p><p className="mt-1 text-xs text-muted-foreground">Actions stay in Work; the active focus block takes over when you start one.</p></div><Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Close detail</Button></div>
    <section className="rounded-lg border border-border bg-card p-6"><div className="flex items-start justify-between gap-6"><div className="min-w-0 flex-1"><p className="text-sm text-muted-foreground">{goal.department.name.replace('Department of ', '')}</p>{editing ? <div className="mt-2 space-y-2"><Input value={title} onChange={(event) => setTitle(event.target.value)} /><Textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} rows={3} /><div className="flex gap-2"><Button size="sm" onClick={() => store.updateGoal(goal.id, { title, outcome }).then(() => setEditing(false)).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not save outcome'))}>Save changes</Button><Button size="sm" variant="ghost" onClick={() => { setTitle(goal.title); setOutcome(goal.outcome); setEditing(false) }}>Cancel</Button></div></div> : <><h2 className="ledger-page-title mt-1 text-3xl">{goal.title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{goal.outcome}</p></>}</div><div className="text-right"><p className="ledger-metric text-5xl text-[var(--growth)]">{Math.round(progress * 100)}%</p><p className="text-xs text-muted-foreground">{deadlineLabel(daysRemaining(goal.targetDate))}</p></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-[var(--growth)] transition-all" style={{ width: `${progress * 100}%` }} /></div><div className="mt-4 flex flex-wrap gap-2">{goal.status === 'active' ? <Button variant="outline" size="sm" onClick={() => store.updateGoal(goal.id, { status: 'paused' })}><Pause className="h-3.5 w-3.5" /> Pause outcome</Button> : <Button variant="outline" size="sm" onClick={() => store.updateGoal(goal.id, { status: 'active' })}><Play className="h-3.5 w-3.5" /> Activate outcome</Button>}<Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit outcome</Button><Button variant="ghost" size="sm" onClick={() => store.updateGoal(goal.id, { status: 'completed' })}><Check className="h-3.5 w-3.5" /> Finish outcome</Button></div></section>
    <section className="space-y-3"><div><LedgerSectionLabel>Steps for this outcome</LedgerSectionLabel><LedgerMeta className="mt-1">Backlog is everything you have recorded. Today&apos;s queue is the small set you chose to act on now.</LedgerMeta></div><ActionsPanel goal={goal} /></section>
  </div>
}

function ActionsPanel({ goal }: { goal: Goal }) {
  const [title, setTitle] = useState('')
  const [finishHint, setFinishHint] = useState('')
  const [minutes, setMinutes] = useState('45')
  const [dueDate, setDueDate] = useState(toKey(new Date()))
  const [subdepartmentId, setSubdepartmentId] = useState(goal.department.subdepartments[0]?.id ?? '')
  const [planToday, setPlanToday] = useState(true)
  const [busy, setBusy] = useState(false)

  async function add() {
    if (busy || !title.trim() || Number(minutes) <= 0) return
    setBusy(true)
    try {
      await store.addGoalAction({ goalId: goal.id, title: title.trim(), definitionOfDone: finishHint.trim() || null, plannedMinutes: Number(minutes), context: 'focused', dueDate: dueDate || null, subdepartmentId: subdepartmentId || null, status: planToday ? 'today' : 'backlog' })
      setTitle(''); setFinishHint(''); toast.success(planToday ? "Step added to today's queue" : 'Step saved to backlog')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add step') }
    finally { setBusy(false) }
  }

  async function updateStatus(id: string, status: 'today' | 'backlog') {
    try { await store.updateGoalAction(id, { status }); toast.success(status === 'today' ? 'Step planned for today' : 'Step moved to backlog') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update step') }
  }

  const actions = [...goal.actions].sort((a, b) => statusOrder(a.status) - statusOrder(b.status))
  return <div className="space-y-3">
    {actions.filter((action) => action.status !== 'cancelled').map((action) => <LedgerRow key={action.id} className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className={cn('text-sm font-medium', action.status === 'completed' && 'text-muted-foreground line-through')}>{action.title}</p><p className="mt-1 text-xs text-muted-foreground">{action.plannedMinutes}m{action.dueDate ? ` · ${action.dueDate}` : ''} · {actionStatusLabel(action.status)}</p>{action.definitionOfDone && <p className="mt-2 text-sm text-muted-foreground">Finish condition: {action.definitionOfDone}</p>}</div><div className="flex shrink-0 gap-1">{action.status === 'backlog' && <Button size="sm" variant="outline" onClick={() => updateStatus(action.id, 'today')}>Plan for today</Button>}{action.status === 'today' && <Button size="sm" variant="ghost" onClick={() => updateStatus(action.id, 'backlog')}>Move to backlog</Button>}{!['completed', 'cancelled'].includes(action.status) && <Button size="sm" variant="ghost" onClick={() => store.updateGoalAction(action.id, { status: 'cancelled' }).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not archive step'))}>Archive</Button>}</div></LedgerRow>)}
    <LedgerPanel><LedgerSectionLabel>Add a step</LedgerSectionLabel><LedgerMeta className="mt-1">Keep it small enough to start and finish in one focus block.</LedgerMeta><div className="mt-4 space-y-3"><div className="grid gap-2 sm:grid-cols-[1fr_110px]"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Concrete work to do" /><div><Label>Minutes</Label><Input type="number" min={1} max={720} value={minutes} onChange={(event) => setMinutes(event.target.value)} /></div></div><div><Label>Finish condition <span className="font-normal text-muted-foreground">(optional)</span></Label><Input value={finishHint} onChange={(event) => setFinishHint(event.target.value)} placeholder="What would make this feel complete?" /></div><div className="grid gap-2 sm:grid-cols-2"><div><Label>Area</Label><select value={subdepartmentId} onChange={(event) => setSubdepartmentId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">No category</option>{goal.department.subdepartments.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}</select></div><div><Label>Due</Label><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div></div><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={planToday} onChange={(event) => setPlanToday(event.target.checked)} className="mt-0.5" /><span><span className="block">Plan for today</span><span className="text-xs text-muted-foreground">If off, it stays in backlog and will not enter the queue.</span></span></label><Button onClick={add} disabled={busy || !title.trim() || Number(minutes) <= 0}><Plus className="h-4 w-4" /> Add step</Button></div></LedgerPanel>
  </div>
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
function sprintStatusLabel(status: string) { return status === 'active' ? 'Current' : status === 'completed' ? 'Finished' : status === 'paused' ? 'Paused' : 'Planned' }
function actionStatusLabel(status: string) { return status === 'today' ? 'Planned for today' : status === 'in_progress' ? 'In focus' : status === 'completed' ? 'Finished' : 'Backlog' }
function statusOrder(status: string) { return status === 'in_progress' ? 0 : status === 'today' ? 1 : status === 'backlog' ? 2 : 3 }
