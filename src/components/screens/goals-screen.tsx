'use client'

import { useState } from 'react'
import { ArrowLeft, Check, ChevronRight, CirclePlus, FlaskConical, Gauge, GraduationCap, Landmark, Pause, Play, Plus, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

export function GoalsScreen() {
  const { goals, loading } = useGoals()
  const { departments } = useDepartments()
  const { sprints } = useSprints()
  const activeGoalId = useUIStore((s) => s.activeGoalId)
  const openGoal = useUIStore((s) => s.openGoal)
  const closeGoal = useUIStore((s) => s.closeGoal)
  const activeGoal = goals.find((goal) => goal.id === activeGoalId)
  const visibleGoals = goals.filter((goal) => !['completed', 'abandoned'].includes(goal.status))
  const activeSprint = sprints.find((sprint) => sprint.status === 'active')
  const activeSprintGoalIds = new Set(activeSprint?.goals.map((link) => link.goalId) ?? [])
  const sprintGoals = visibleGoals.filter((goal) => activeSprintGoalIds.has(goal.id))
  const otherGoals = visibleGoals.filter((goal) => !activeSprintGoalIds.has(goal.id))
  const hasExecution = goals.some((goal) => goal.actions.some((action) => action.status === 'today' || action.status === 'in_progress'))

  if (activeGoal) return <GoalWorkbench goal={activeGoal} onBack={closeGoal} />

  return (
    <div className="space-y-7 max-w-4xl mx-auto">
      <h1 className="font-serif text-3xl">Work</h1>

      {hasExecution && <TodayScreen />}
      <SprintPanel />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">Outcomes</h2>
          <CreateGoalPanel departments={departments} sprintId={activeSprint?.id ?? null} sprintName={activeSprint?.name ?? null} />
        </div>

      {loading ? <p className="text-sm text-muted-foreground text-center py-8">Loading…</p> : visibleGoals.length === 0 ? null : (
        <>
          {activeSprint && (sprintGoals.length > 0 ? <div className="space-y-2">{sprintGoals.map((goal) => <GoalRow key={goal.id} goal={goal} onClick={() => openGoal(goal.id)} />)}</div> : <div className="rounded-lg border border-dashed border-border px-4 py-7 text-center text-sm text-muted-foreground">No outcomes in this Sprint.</div>)}
          {otherGoals.length > 0 && <section className="space-y-2 pt-2"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Outside this Sprint</p><div className="space-y-2">{otherGoals.map((goal) => <GoalRow key={goal.id} goal={goal} onClick={() => openGoal(goal.id)} />)}</div></section>}
        </>
      )}
      </section>
    </div>
  )
}

function CreateGoalPanel({ departments, sprintId, sprintName }: { departments: ReturnType<typeof useDepartments>['departments']; sprintId: string | null; sprintName: string | null }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const today = toKey(new Date())
  const initialTarget = toKey(addDays(new Date(), 17))
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [outcome, setOutcome] = useState('')
  const [targetDate, setTargetDate] = useState(initialTarget)

  const effectiveDepartmentId = departmentId || departments[0]?.id || ''

  async function createCustom() {
    if (!effectiveDepartmentId || !title.trim() || !outcome.trim()) return
    setBusy(true)
    try {
      await store.createGoal({ departmentId: effectiveDepartmentId, title, outcome, startDate: today, targetDate, sprintId })
      setTitle(''); setOutcome(''); setOpen(false)
      toast.success('Goal created')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create goal')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><CirclePlus className="h-4 w-4 mr-1" /> Add outcome</Button></DialogTrigger>
      <DialogContent className="sm:max-w-xl md:left-[calc(50%+7rem)]">
        <DialogHeader><DialogTitle className="font-serif text-xl">New outcome</DialogTitle><DialogDescription>{sprintName ? `Adds to ${sprintName}` : 'Not attached to a Sprint'}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Area</Label><select value={effectiveDepartmentId} onChange={(e) => setDepartmentId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{departments.map((d) => <option key={d.id} value={d.id}>{d.name.replace('Department of ', '')}</option>)}</select></div>
              <div><Label className="text-xs">Due</Label><Input type="date" min={today} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">Outcome</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Get a 7 in Physics" /></div>
            <div><Label className="text-xs">Finished when</Label><Textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={2} placeholder="What result proves this is done?" /></div>
            <div className="flex gap-2"><Button onClick={createCustom} disabled={busy || !title.trim() || !outcome.trim()}>Add outcome</Button><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
          </div>
      </DialogContent>
    </Dialog>
  )
}

function GoalRow({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const progress = goalProgress(goal)
  const nextActions = goal.actions.filter((action) => !['completed', 'cancelled'].includes(action.status)).length
  return (
    <button onClick={onClick} className="w-full text-left border border-border rounded-lg p-4 hover:border-foreground/25 transition">
      <div className="flex items-start gap-3">
        <ModuleIcon moduleKey={goal.moduleKey} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3"><div><p className="font-serif text-xl">{goal.title}</p><p className="text-xs text-muted-foreground mt-1">{goal.department.name.replace('Department of ', '')}</p></div><ChevronRight className="h-4 w-4 text-muted-foreground mt-1" /></div>
          <div className="flex items-center gap-3 mt-3"><div className="h-1.5 bg-muted rounded-full overflow-hidden flex-1"><div className="h-full bg-[var(--growth)]" style={{ width: `${progress * 100}%` }} /></div><span className="text-sm tabular-nums">{Math.round(progress * 100)}%</span></div>
          <p className="text-xs text-muted-foreground mt-2">{deadlineLabel(daysRemaining(goal.targetDate))} · {nextActions} open step{nextActions === 1 ? '' : 's'}</p>
        </div>
      </div>
    </button>
  )
}

function GoalWorkbench({ goal, onBack }: { goal: Goal; onBack: () => void }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(goal.title)
  const [outcome, setOutcome] = useState(goal.outcome)
  const progress = goalProgress(goal)

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Work</Button>
      <section>
        <div className="flex items-start justify-between gap-4"><div className="min-w-0 flex-1"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{goal.department.name.replace('Department of ', '')}</p>{editing ? <div className="space-y-2 mt-2"><Input value={title} onChange={(event) => setTitle(event.target.value)} /><Textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} rows={2} /><div className="flex gap-2"><Button size="sm" onClick={() => { store.updateGoal(goal.id, { title, outcome }).then(() => setEditing(false)).catch((error) => toast.error(error.message)) }}>Save</Button><Button size="sm" variant="ghost" onClick={() => { setTitle(goal.title); setOutcome(goal.outcome); setEditing(false) }}>Cancel</Button></div></div> : <><h1 className="font-serif text-3xl mt-1">{goal.title}</h1><p className="text-sm text-muted-foreground mt-2">{goal.outcome}</p></>}</div><div className="text-right"><p className="font-serif text-4xl text-[var(--growth)]">{Math.round(progress * 100)}%</p><p className="text-[11px] text-muted-foreground">{deadlineLabel(daysRemaining(goal.targetDate))}</p></div></div>
        <div className="h-2 bg-muted rounded-full overflow-hidden mt-4"><div className="h-full bg-[var(--growth)]" style={{ width: `${progress * 100}%` }} /></div>
        <div className="flex flex-wrap gap-2 mt-3">
          {goal.status === 'active' ? <Button variant="outline" size="sm" onClick={() => store.updateGoal(goal.id, { status: 'paused' })}><Pause className="h-3.5 w-3.5 mr-1" /> Pause</Button> : <Button variant="outline" size="sm" onClick={() => store.updateGoal(goal.id, { status: 'active' })}><Play className="h-3.5 w-3.5 mr-1" /> Activate</Button>}
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => store.updateGoal(goal.id, { status: 'completed' })}><Check className="h-3.5 w-3.5 mr-1" /> Complete</Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { if (window.confirm('Archive this goal?')) store.updateGoal(goal.id, { status: 'abandoned' }) }}>Archive</Button>
        </div>
      </section>

      <section className="space-y-3"><h2 className="font-serif text-2xl">Steps</h2><ActionsPanel goal={goal} /></section>
    </div>
  )
}

function ActionsPanel({ goal }: { goal: Goal }) {
  const [title, setTitle] = useState('')
  const [done, setDone] = useState('')
  const [minutes, setMinutes] = useState('45')
  const [dueDate, setDueDate] = useState(toKey(new Date()))
  const [subdepartmentId, setSubdepartmentId] = useState(goal.department.subdepartments[0]?.id ?? '')
  const [commit, setCommit] = useState(true)
  const [busy, setBusy] = useState(false)
  async function add() {
    if (busy) return
    setBusy(true)
    try {
      await store.addGoalAction({ goalId: goal.id, title, definitionOfDone: done || null, plannedMinutes: Number(minutes), context: 'focused', dueDate: dueDate || null, subdepartmentId: subdepartmentId || null, status: commit ? 'today' : 'backlog' })
      setTitle(''); setDone('')
      toast.success(commit ? 'Added to Today' : 'Step saved')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add step') }
    finally { setBusy(false) }
  }
  const actions = [...goal.actions].sort((a, b) => statusOrder(a.status) - statusOrder(b.status))
  return <div className="space-y-3">
    {actions.filter((action) => action.status !== 'cancelled').map((action) => <div key={action.id} className="border-b border-border py-3 flex items-start gap-3"><div className="flex-1"><p className={cn('text-sm font-medium', action.status === 'completed' && 'line-through text-muted-foreground')}>{action.title}</p><p className="text-xs text-muted-foreground mt-1">{action.plannedMinutes}m{action.dueDate ? ` · ${action.dueDate}` : ''} · {action.status === 'today' ? 'Today' : action.status.replace('_', ' ')}</p>{action.definitionOfDone && <p className="text-sm text-muted-foreground mt-1">{action.definitionOfDone}</p>}</div><div className="flex gap-1">{action.status === 'backlog' && <Button size="sm" variant="outline" onClick={() => store.updateGoalAction(action.id, { status: 'today' }).catch((err) => toast.error(err.message))}>Today</Button>}{!['completed', 'cancelled'].includes(action.status) && <Button size="sm" variant="ghost" onClick={() => store.updateGoalAction(action.id, { status: 'cancelled' }).catch((err) => toast.error(err.message))}>Archive</Button>}</div></div>)}
    <Card className="border-border/70"><CardHeader className="pb-2"><CardTitle className="text-base">Add step</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid sm:grid-cols-[1fr_110px] gap-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Concrete work to do" /><div><Label className="text-xs">Minutes</Label><Input type="number" min={1} max={720} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div></div><Input value={done} onChange={(e) => setDone(e.target.value)} placeholder="Finished when… (optional)" /><div className="grid sm:grid-cols-2 gap-2"><div><Label className="text-xs">Area</Label><select value={subdepartmentId} onChange={(e) => setSubdepartmentId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">No category</option>{goal.department.subdepartments.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}</select></div><div><Label className="text-xs">Due</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={commit} onChange={(e) => setCommit(e.target.checked)} /> Put in Today</label><Button onClick={add} disabled={busy || !title.trim() || Number(minutes) <= 0}><Plus className="h-4 w-4 mr-1" /> Add step</Button></CardContent></Card>
  </div>
}

function ModuleIcon({ moduleKey }: { moduleKey: string }) {
  const cls = 'h-5 w-5 text-[var(--growth)]'
  if (moduleKey === 'education') return <GraduationCap className={cls} />
  if (moduleKey === 'research') return <FlaskConical className={cls} />
  if (moduleKey === 'engineering') return <Wrench className={cls} />
  if (moduleKey === 'revenue') return <Landmark className={cls} />
  return <Gauge className={cls} />
}

function deadlineLabel(days: number) { return days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'due today' : `${days}d remaining` }
function statusOrder(status: string) { return status === 'in_progress' ? 0 : status === 'today' ? 1 : status === 'backlog' ? 2 : 3 }
