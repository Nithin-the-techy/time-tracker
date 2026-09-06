'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, CirclePlus, FlaskConical, Gauge, GraduationCap, Landmark, Pause, Play, Plus, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useDepartments, useGoals, useSprints, store, type Goal } from '@/lib/hooks'
import { departmentModule, DEPARTMENT_MODULES } from '@/lib/department-modules'
import { daysRemaining, formatTargetValue, goalProgress, targetProgress } from '@/lib/goal-metrics'
import { toKey, addDays } from '@/lib/dates'
import { useUIStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { SprintPanel } from '@/components/sprint-panel'
import { TodayScreen } from '@/components/screens/today-screen'

export function GoalsScreen() {
  const { goals, loading } = useGoals()
  const { departments } = useDepartments()
  const activeGoalId = useUIStore((s) => s.activeGoalId)
  const openGoal = useUIStore((s) => s.openGoal)
  const closeGoal = useUIStore((s) => s.closeGoal)
  const activeGoal = goals.find((goal) => goal.id === activeGoalId)

  if (activeGoal) return <GoalWorkbench goal={activeGoal} onBack={closeGoal} />

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Plan and execute</p>
        <h1 className="font-serif text-3xl mt-1">Work</h1>
        <p className="text-sm text-muted-foreground mt-2">Set outcomes, phases, and the next actions that move them.</p>
      </div>

      <TodayScreen />
      <CreateGoalPanel departments={departments} />
      <SprintPanel />

      {loading ? <p className="text-sm text-muted-foreground text-center py-8">Loading goals…</p> : goals.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No goals yet. Create one when you have an outcome to pursue.</p>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => <GoalRow key={goal.id} goal={goal} onClick={() => openGoal(goal.id)} />)}
        </div>
      )}
    </div>
  )
}

function CreateGoalPanel({ departments }: { departments: ReturnType<typeof useDepartments>['departments'] }) {
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
      await store.createGoal({ departmentId: effectiveDepartmentId, title, outcome, startDate: today, targetDate })
      setTitle(''); setOutcome(''); setOpen(false)
      toast.success('Goal created. Define what 100% means next.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create goal')
    } finally { setBusy(false) }
  }

  return (
    <Card className="border-[var(--growth)]/20">
      <CardContent className="p-4 space-y-4">
        {!open ? (
          <Button variant="outline" className="w-full" onClick={() => setOpen(true)}><CirclePlus className="h-4 w-4 mr-1" /> Create goal</Button>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label className="text-[11px]">Department</Label><select value={effectiveDepartmentId} onChange={(e) => setDepartmentId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{departments.map((d) => <option key={d.id} value={d.id}>{d.name.replace('Department of ', '')} · {departmentModule(d.moduleKey).label}</option>)}</select></div>
              <div><Label className="text-[11px]">Target date</Label><Input type="date" min={today} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>
            </div>
            <div><Label className="text-[11px]">Goal</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Produce a specific state" /></div>
            <div><Label className="text-[11px]">Observable outcome</Label><Textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={2} placeholder="What exactly will be true at 100%?" /></div>
            <div className="flex gap-2"><Button onClick={createCustom} disabled={busy || !title.trim() || !outcome.trim()}>Create goal</Button><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function GoalRow({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const progress = goalProgress(goal)
  const workflow = departmentModule(goal.moduleKey)
  const openProblems = goal.problems.filter((problem) => problem.status === 'open').length
  const nextActions = goal.actions.filter((action) => !['completed', 'cancelled'].includes(action.status)).length
  return (
    <button onClick={onClick} className="w-full text-left border border-border rounded-lg p-4 hover:border-foreground/25 transition">
      <div className="flex items-start gap-3">
        <ModuleIcon moduleKey={goal.moduleKey} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3"><div><p className="font-serif text-xl">{goal.title}</p><p className="text-xs text-muted-foreground mt-1">{goal.department.name.replace('Department of ', '')} · {workflow.label} · {goal.status}</p></div><ChevronRight className="h-4 w-4 text-muted-foreground mt-1" /></div>
          <div className="flex items-center gap-3 mt-3"><div className="h-1.5 bg-muted rounded-full overflow-hidden flex-1"><div className="h-full bg-[var(--growth)]" style={{ width: `${progress * 100}%` }} /></div><span className="text-sm tabular-nums">{Math.round(progress * 100)}%</span></div>
          <p className="text-[11px] text-muted-foreground mt-2">{deadlineLabel(daysRemaining(goal.targetDate))} · {openProblems} open gaps · {nextActions} next actions</p>
        </div>
      </div>
    </button>
  )
}

function GoalWorkbench({ goal, onBack }: { goal: Goal; onBack: () => void }) {
  const workflow = departmentModule(goal.moduleKey)
  const [section, setSection] = useState<'targets' | 'problems' | 'actions'>('targets')
  const progress = goalProgress(goal)
  const unresolved = goal.problems.filter((p) => p.status === 'open')

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> All work</Button>
      <TodayScreen />
      <section>
        <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{workflow.label} workbench</p><h1 className="font-serif text-3xl mt-1">{goal.title}</h1><p className="text-sm text-muted-foreground mt-2">{goal.outcome}</p></div><div className="text-right"><p className="font-serif text-4xl text-[var(--growth)]">{Math.round(progress * 100)}%</p><p className="text-[11px] text-muted-foreground">{deadlineLabel(daysRemaining(goal.targetDate))}</p></div></div>
        <div className="h-2 bg-muted rounded-full overflow-hidden mt-4"><div className="h-full bg-[var(--growth)]" style={{ width: `${progress * 100}%` }} /></div>
        <SprintLinkPanel goal={goal} />
        <div className="flex flex-wrap gap-2 mt-3">
          {goal.status === 'active' ? <Button variant="outline" size="sm" onClick={() => store.updateGoal(goal.id, { status: 'paused' })}><Pause className="h-3.5 w-3.5 mr-1" /> Pause</Button> : <Button variant="outline" size="sm" onClick={() => store.updateGoal(goal.id, { status: 'active' })}><Play className="h-3.5 w-3.5 mr-1" /> Activate</Button>}
          <Button variant="ghost" size="sm" onClick={() => store.updateGoal(goal.id, { status: 'completed' })}><Check className="h-3.5 w-3.5 mr-1" /> Mark complete</Button>
        </div>
      </section>

      <div className="grid grid-cols-3 rounded-md border border-border p-1">
        {(['targets', 'problems', 'actions'] as const).map((value) => <button key={value} onClick={() => setSection(value)} className={cn('rounded px-3 py-2 text-sm capitalize', section === value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>{value}{value === 'problems' ? ` · ${unresolved.length}` : ''}</button>)}
      </div>

      {section === 'targets' && <TargetsPanel goal={goal} />}
      {section === 'problems' && <ProblemsPanel goal={goal} />}
      {section === 'actions' && <ActionsPanel goal={goal} />}
    </div>
  )
}

function SprintLinkPanel({ goal }: { goal: Goal }) {
  const { sprints } = useSprints()
  const [sprintId, setSprintId] = useState('')
  const linked = sprints.filter((sprint) => sprint.goals.some((link) => link.goalId === goal.id))
  const available = sprints.filter((sprint) => !sprint.goals.some((link) => link.goalId === goal.id) && sprint.status !== 'archived')
  async function attach() {
    const sprint = sprints.find((item) => item.id === sprintId)
    if (!sprint) return
    try { await store.updateSprint(sprint.id, { goalIds: [...sprint.goals.map((link) => link.goalId), goal.id] }); setSprintId(''); toast.success('Goal added to Sprint') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not link Sprint') }
  }
  return <div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Sprints:</span>{linked.length ? linked.map((sprint) => <span key={sprint.id} className="rounded-full border border-border px-2 py-1">{sprint.name}</span>) : <span className="text-muted-foreground">none</span>}{available.length > 0 && <><select value={sprintId} onChange={(e) => setSprintId(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs"><option value="">Add to Sprint…</option>{available.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select><Button size="sm" variant="outline" onClick={attach} disabled={!sprintId}>Add</Button></>}</div>
}

function TargetsPanel({ goal }: { goal: Goal }) {
  const workflow = departmentModule(goal.moduleKey)
  const [label, setLabel] = useState('')
  const [unit, setUnit] = useState(workflow.suggestedUnits[0])
  const [targetValue, setTargetValue] = useState('')
  const [subdepartmentId, setSubdepartmentId] = useState('')
  async function add() {
    try {
      await store.addGoalTarget({ goalId: goal.id, label, unit, targetValue: Number(targetValue), subdepartmentId: subdepartmentId || null, progressSource: unit === 'minutes' ? 'productive_minutes' : 'manual' })
      setLabel(''); setTargetValue('')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add target') }
  }
  return <div className="space-y-3">
    {goal.targets.map((target) => <div key={target.id} className="border border-border rounded-md p-3"><div className="flex justify-between gap-3"><div><p className="text-sm font-medium">{target.label}</p><p className="text-[11px] text-muted-foreground">{target.progressSource.replace('_', ' ')}</p></div><p className="text-sm tabular-nums">{formatTargetValue(target.currentValue, target.unit)} / {formatTargetValue(target.targetValue, target.unit)}</p></div><div className="h-1.5 bg-muted rounded-full mt-2"><div className="h-full bg-[var(--growth)] rounded-full" style={{ width: `${targetProgress(target) * 100}%` }} /></div>{target.progressSource === 'manual' && <div className="flex items-center gap-2 mt-2"><Input type="number" min={0} className="h-8 w-28" defaultValue={target.currentValue} onBlur={(e) => store.updateGoalTarget(target.id, { currentValue: Number(e.target.value) }).catch((err) => toast.error(err.message))} /><span className="text-[11px] text-muted-foreground">update current value</span></div>}</div>)}
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Add {workflow.targetNoun}</CardTitle></CardHeader><CardContent className="grid sm:grid-cols-2 gap-2"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" /><select value={subdepartmentId} onChange={(e) => setSubdepartmentId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">No sub-department</option>{goal.department.subdepartments.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}</select><select value={unit} onChange={(e) => setUnit(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{workflow.suggestedUnits.map((u) => <option key={u}>{u}</option>)}</select><Input type="number" min={0.1} value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="Target value" /><Button className="sm:col-span-2" onClick={add} disabled={!label.trim() || Number(targetValue) <= 0}><Plus className="h-4 w-4 mr-1" /> Add target</Button></CardContent></Card>
  </div>
}

function ProblemsPanel({ goal }: { goal: Goal }) {
  const workflow = departmentModule(goal.moduleKey)
  const [statement, setStatement] = useState('')
  const [evidence, setEvidence] = useState('')
  async function add() { try { await store.addGoalProblem({ goalId: goal.id, statement, evidence }); setStatement(''); setEvidence('') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add problem') } }
  return <div className="space-y-3">{goal.problems.map((problem) => <div key={problem.id} className={cn('border rounded-md p-3 flex gap-3', problem.status === 'open' ? 'border-amber-400/25' : 'border-border opacity-70')}><div className="flex-1"><p className="text-sm">{problem.statement}</p>{problem.evidence && <p className="text-xs text-muted-foreground mt-1">Solved when: {problem.evidence}</p>}</div>{problem.status === 'open' && <Button size="sm" variant="outline" onClick={() => store.updateGoalProblem(problem.id, { status: 'solved' })}><Check className="h-3.5 w-3.5 mr-1" /> Solved</Button>}</div>)}<Card><CardHeader className="pb-2"><CardTitle className="text-sm">Expose a gap</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-xs text-muted-foreground">{workflow.problemPrompt}</p><Textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={2} placeholder="Current gap" /><Input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Evidence that means solved" /><Button onClick={add} disabled={!statement.trim()}><Plus className="h-4 w-4 mr-1" /> Add problem</Button></CardContent></Card></div>
}

function ActionsPanel({ goal }: { goal: Goal }) {
  const workflow = departmentModule(goal.moduleKey)
  const [title, setTitle] = useState('')
  const [done, setDone] = useState('')
  const [minutes, setMinutes] = useState('25')
  const [context, setContext] = useState(workflow.suggestedContexts[0])
  const [targetId, setTargetId] = useState('')
  const [problemId, setProblemId] = useState('')
  const [commit, setCommit] = useState(true)
  const target = goal.targets.find((item) => item.id === targetId)
  async function add() { try { await store.addGoalAction({ goalId: goal.id, title, definitionOfDone: done, plannedMinutes: Number(minutes), context, targetId: targetId || null, problemId: problemId || null, subdepartmentId: target?.subdepartmentId ?? null, status: commit ? 'today' : 'backlog' }); setTitle(''); setDone('') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add action') } }
  const actions = [...goal.actions].sort((a, b) => statusOrder(a.status) - statusOrder(b.status))
  return <div className="space-y-3">{actions.map((action) => <div key={action.id} className="border border-border rounded-md p-3 flex items-start gap-3"><div className="flex-1"><p className={cn('text-sm', action.status === 'completed' && 'line-through text-muted-foreground')}>{action.title}</p><p className="text-[11px] text-muted-foreground mt-1">{action.status.replace('_', ' ')} · {action.context} · {action.plannedMinutes}m{action.target ? ` · ${action.target.label}` : ''}</p>{action.definitionOfDone && <p className="text-xs mt-1">Done: {action.definitionOfDone}</p>}</div>{action.status === 'backlog' && <Button size="sm" variant="outline" onClick={() => store.updateGoalAction(action.id, { status: 'today' }).catch((err) => toast.error(err.message))}>Commit today</Button>}</div>)}<Card><CardHeader className="pb-2"><CardTitle className="text-sm">Create the next physical action</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-xs text-muted-foreground">{workflow.actionPrompt}</p><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Verb-first action" /><Input value={done} onChange={(e) => setDone(e.target.value)} placeholder={workflow.outputPrompt} /><div className="grid sm:grid-cols-2 gap-2"><select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">No target</option>{goal.targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select><select value={problemId} onChange={(e) => setProblemId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">No linked problem</option>{goal.problems.filter((p) => p.status === 'open').map((p) => <option key={p.id} value={p.id}>{p.statement}</option>)}</select><select value={context} onChange={(e) => setContext(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{workflow.suggestedContexts.map((value) => <option key={value}>{value}</option>)}</select><Input type="number" min={1} max={720} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div><label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={commit} onChange={(e) => setCommit(e.target.checked)} /> Commit to Today (maximum three)</label><Button onClick={add} disabled={!title.trim() || Number(minutes) <= 0}><Plus className="h-4 w-4 mr-1" /> Add action</Button></CardContent></Card></div>
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
