'use client'

import { useEffect, useState } from 'react'
import { Archive, ArrowLeft, Check, CirclePlus, MoreHorizontal, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FormField, LedgerMeta, LedgerPanel, LedgerRow, LedgerSectionLabel } from '@/components/quiet-ledger'
import { useDepartments, useGoals, useSprints, store, type Goal, type GoalAction, type GoalProblem, type GoalTarget } from '@/lib/hooks'
import { actionLoggedMinutes, daysRemaining, goalLoggedMinutes, goalProgressInfo } from '@/lib/goal-metrics'
import { formatMinutes } from '@/lib/metrics'
import { toKey, addDays } from '@/lib/dates'
import { useUIStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { SprintPanel } from '@/components/sprint-panel'
import { findRunningSession, RunningSession, TodayScreen } from '@/components/screens/today-screen'

export function GoalsScreen() {
  const { goals, loading } = useGoals()
  const { departments } = useDepartments()
  const { sprints } = useSprints()
  const activeGoalId = useUIStore((state) => state.activeGoalId)
  const openGoal = useUIStore((state) => state.openGoal)
  const closeGoal = useUIStore((state) => state.closeGoal)
  const activeGoal = goals.find((goal) => goal.id === activeGoalId)
  const running = findRunningSession(goals)
  const visibleGoals = goals.filter((goal) => !['completed', 'abandoned', 'archived'].includes(goal.status))
  const visibleSprints = sprints.filter((sprint) => sprint.status !== 'archived')

  useEffect(() => {
    if (activeGoalId && !activeGoal && !loading) closeGoal()
  }, [activeGoal, activeGoalId, closeGoal, loading])

  return <div className="work-screen mx-auto max-w-[1280px] overflow-x-hidden pb-12">
    <header className="work-page-head"><div><p className="work-eyebrow">Execution</p><h1 className="ledger-page-title">Work</h1></div><CreateOutcomeDialog departments={departments} activeSprintId={sprints.find((sprint) => sprint.status === 'active')?.id ?? null} /></header>
    <div className="work-layout">
      <main className="min-w-0">{running ? <RunningSession session={running.session} action={running.action} goalTitle={running.goal.title} availableSteps={goals.flatMap((goal) => goal.actions.filter((action) => action.status === 'today' && action.id !== running.action.id).map((action) => ({ action, goalTitle: goal.title })))} /> : activeGoal ? <GoalWorkbench goal={activeGoal} onBack={closeGoal} /> : <TodayScreen />}</main>
      <aside className="work-rail" aria-label="Work navigation"><SprintPanel /><OutcomeNavigator goals={visibleGoals} sprints={visibleSprints} loading={loading} onOpenGoal={openGoal} /></aside>
    </div>
  </div>
}

function OutcomeNavigator({ goals, sprints, loading, onOpenGoal }: { goals: Goal[]; sprints: ReturnType<typeof useSprints>['sprints']; loading: boolean; onOpenGoal: (id: string) => void }) {
  const activeSprint = sprints.find((sprint) => sprint.status === 'active')
  const goalById = new Map(goals.map((goal) => [goal.id, goal]))
  const linkedIds = new Set(sprints.flatMap((sprint) => sprint.goals.map((link) => link.goalId)))
  const outside = goals.filter((goal) => !linkedIds.has(goal.id))
  const renderGoal = (goal: Goal) => {
    const info = goalProgressInfo(goal)
    return <button key={goal.id} type="button" onClick={() => onOpenGoal(goal.id)} className="work-outcome-row group w-full text-left"><span className={cn('work-outcome-marker', info.ratio === null ? 'bg-muted-foreground/40' : info.ratio >= 1 ? 'bg-[var(--growth)]' : 'bg-[var(--growth)]/70')} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{goal.title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{goal.department.name.replace('Department of ', '')} · {info.label}</span>{info.ratio !== null && <span className="mt-2 block h-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-[var(--growth)]" style={{ width: `${info.ratio * 100}%` }} /></span>}</span><span className="ml-2 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true">›</span></button>
  }
  return <section className="space-y-3" aria-labelledby="outcomes-heading"><div className="flex items-center justify-between gap-3"><LedgerSectionLabel id="outcomes-heading">Outcomes</LedgerSectionLabel><span className="text-xs tabular-nums text-muted-foreground">{goals.length}</span></div>{loading ? <div className="space-y-3"><div className="h-12 animate-pulse rounded-md bg-muted/20" /><div className="h-12 animate-pulse rounded-md bg-muted/20" /></div> : goals.length === 0 ? <div className="work-empty-rail"><p className="text-sm font-medium">No Outcomes yet.</p></div> : <div className="divide-y divide-border/70">{activeSprint && <div className="pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{activeSprint.name}</div>}{activeSprint?.goals.map((link) => goalById.get(link.goalId)).filter((goal): goal is Goal => Boolean(goal)).map(renderGoal)}{outside.length > 0 && <><div className="mt-4 border-t border-border/70 pt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Outside current Sprint</div>{outside.map(renderGoal)}</>}</div>}</section>
}

function CreateOutcomeDialog({ departments, activeSprintId }: { departments: ReturnType<typeof useDepartments>['departments']; activeSprintId: string | null }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [targetDate, setTargetDate] = useState(toKey(addDays(new Date(), 14)))
  const [busy, setBusy] = useState(false)
  const effectiveDepartmentId = departmentId || departments[0]?.id || ''
  const today = toKey(new Date())
  async function create() {
    if (!effectiveDepartmentId || !title.trim() || busy) return
    setBusy(true)
    try { await store.createGoal({ departmentId: effectiveDepartmentId, title: title.trim(), outcome: title.trim(), startDate: today, targetDate, sprintId: activeSprintId }); setTitle(''); setOpen(false); toast.success('Outcome created') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create Outcome') }
    finally { setBusy(false) }
  }
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}><CirclePlus className="h-4 w-4" /> Add Outcome</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Add an Outcome</DialogTitle></DialogHeader><div className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><FormField label="Area" required><select value={effectiveDepartmentId} onChange={(event) => setDepartmentId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">Choose an area</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name.replace('Department of ', '')}</option>)}</select></FormField><FormField label="Due" required><Input type="date" min={today} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></FormField></div><FormField label="Outcome" required><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Publish the literature review" /></FormField></div><DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void create()} disabled={busy || !title.trim() || !effectiveDepartmentId}>{busy ? 'Creating…' : 'Create Outcome'}</Button></DialogFooter></DialogContent></Dialog></>
}

function GoalWorkbench({ goal, onBack }: { goal: Goal; onBack: () => void }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(goal.title)
  const [details, setDetails] = useState(goal.outcome === goal.title ? '' : goal.outcome)
  const info = goalProgressInfo(goal)
  const loggedMinutes = goalLoggedMinutes(goal)
  async function save() {
    try { await store.updateGoal(goal.id, { title: title.trim() || goal.title, outcome: details.trim() || title.trim() || goal.title }); setEditing(false); toast.success('Outcome updated') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save Outcome') }
  }
  async function archive() {
    try { await store.updateGoal(goal.id, { status: 'archived' }); toast.success('Outcome archived'); onBack() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not archive Outcome') }
  }
  async function remove() {
    if (!window.confirm('Delete this Outcome? It will move to Archived and deleted in Settings.')) return
    try { await store.deleteGoal(goal.id); toast.success('Outcome deleted'); onBack() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not delete Outcome') }
  }
  return <div className="space-y-6"><div className="flex items-center justify-between gap-3"><button type="button" onClick={onBack} className="inline-flex min-h-8 items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to Today</button><span className="text-xs text-muted-foreground">Outcome</span></div><LedgerPanel className="work-outcome-head p-5 md:p-6"><div className="flex items-start justify-between gap-6"><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{goal.department.name.replace('Department of ', '')} · {deadlineLabel(daysRemaining(goal.targetDate))}</p>{editing ? <div className="mt-4 space-y-5"><FormField label="Outcome" required><Input value={title} onChange={(event) => setTitle(event.target.value)} /></FormField><FormField label="Details"><Textarea rows={3} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Anything useful to remember" /></FormField><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void save()}>Save changes</Button><Button size="sm" variant="ghost" onClick={() => { setTitle(goal.title); setDetails(goal.outcome === goal.title ? '' : goal.outcome); setEditing(false) }}>Cancel</Button></div></div> : <><h2 className="ledger-page-title mt-2 text-3xl">{goal.title}</h2>{goal.outcome !== goal.title && <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{goal.outcome}</p>}</>}</div><div className="shrink-0 text-right">{info.ratio !== null ? <><p className="ledger-metric text-4xl tabular-nums text-[var(--growth)]">{Math.round(info.ratio * 100)}%</p><p className="text-xs text-muted-foreground">{goal.targets.length} Measure{goal.targets.length === 1 ? '' : 's'}</p></> : info.totalSteps > 0 ? <><p className="ledger-metric text-2xl tabular-nums">{info.completedSteps}/{info.totalSteps}</p><p className="text-xs text-muted-foreground">Steps done</p></> : <p className="text-sm text-muted-foreground">No progress measure yet</p>}<p className="mt-2 text-xs tabular-nums text-muted-foreground">{formatMinutes(loggedMinutes)} logged</p></div></div>{info.ratio !== null && <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[var(--growth)]" style={{ width: `${info.ratio * 100}%` }} /></div>}<div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void store.updateGoal(goal.id, { status: goal.status === 'active' ? 'paused' : 'active' })}>{goal.status === 'active' ? <><Pause className="h-3.5 w-3.5" /> Put on hold</> : <><Play className="h-3.5 w-3.5" /> Resume</>}</Button><Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>{goal.status !== 'completed' && <Button variant="ghost" size="sm" onClick={() => void store.updateGoal(goal.id, { status: 'completed' })}><Check className="h-3.5 w-3.5" /> Mark complete</Button>}<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Outcome actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => void archive()}><Archive className="h-4 w-4" /> Archive Outcome</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => void remove()}><Trash2 className="h-4 w-4" /> Delete Outcome</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></LedgerPanel><section className="space-y-3"><div className="flex items-baseline justify-between gap-3"><LedgerSectionLabel>Steps</LedgerSectionLabel><span className="text-xs text-muted-foreground">{goal.actions.filter((action) => action.status !== 'cancelled').length} total</span></div><ActionsPanelV2 goal={goal} /></section><OutcomeStructure goal={goal} /></div>
}

function OutcomeStructure({ goal }: { goal: Goal }) {
  const [open, setOpen] = useState(goal.targets.length > 0 || goal.problems.length > 0)
  const [measureLabel, setMeasureLabel] = useState('')
  const [measureValue, setMeasureValue] = useState('1')
  const [measureUnit, setMeasureUnit] = useState('outputs')
  const [blocker, setBlocker] = useState('')
  const [busy, setBusy] = useState(false)
  async function addMeasure() { if (busy || !measureLabel.trim() || Number(measureValue) <= 0) return; setBusy(true); try { await store.addGoalTarget({ goalId: goal.id, label: measureLabel.trim(), unit: measureUnit.trim() || 'outputs', targetValue: Number(measureValue), progressSource: 'manual' }); setMeasureLabel(''); setMeasureValue('1'); toast.success('Measure added') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add Measure') } finally { setBusy(false) } }
  async function addBlocker() { if (busy || !blocker.trim()) return; setBusy(true); try { await store.addGoalProblem({ goalId: goal.id, statement: blocker.trim() }); setBlocker(''); toast.success('Blocker added') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add Blocker') } finally { setBusy(false) } }
  return <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="work-secondary-section"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium"><span>Measures and blockers <span className="ml-1 text-xs font-normal text-muted-foreground">optional</span></span><span className="text-xs text-muted-foreground">{goal.targets.length + goal.problems.length || 'None'}</span></summary><div className="mt-4 border-t border-border/70 pt-4"><p className="text-xs leading-5 text-muted-foreground">Add a Measure when the Outcome needs a fixed number. Add a Blocker only when something is in the way.</p><div className="mt-5 grid gap-6 md:grid-cols-2"><div className="space-y-3"><LedgerSectionLabel>Measures</LedgerSectionLabel>{goal.targets.map((target) => <MeasureRow key={target.id} target={target} />)}<div className="grid gap-3 sm:grid-cols-[1fr_84px]"><FormField label="Measure"><Input value={measureLabel} onChange={(event) => setMeasureLabel(event.target.value)} placeholder="What will move?" /></FormField><FormField label="Target"><Input type="number" min={1} value={measureValue} onChange={(event) => setMeasureValue(event.target.value)} /></FormField></div><div className="flex items-end gap-3"><FormField label="Unit" className="min-w-0 flex-1"><Input value={measureUnit} onChange={(event) => setMeasureUnit(event.target.value)} placeholder="outputs" /></FormField><Button size="sm" variant="outline" onClick={() => void addMeasure()} disabled={busy || !measureLabel.trim()}>Add</Button></div></div><div className="space-y-3"><LedgerSectionLabel>Blockers</LedgerSectionLabel>{goal.problems.map((problem) => <BlockerRow key={problem.id} problem={problem} linkedStepTitle={goal.actions.find((action) => action.problemId === problem.id)?.title ?? null} />)}<div className="flex items-end gap-3"><FormField label="Blocker" className="min-w-0 flex-1"><Input value={blocker} onChange={(event) => setBlocker(event.target.value)} placeholder="What is in the way?" /></FormField><Button size="sm" variant="outline" onClick={() => void addBlocker()} disabled={busy || !blocker.trim()}>Add</Button></div></div></div></div></details>
}

function MeasureRow({ target }: { target: GoalTarget }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(target.currentValue))
  const [busy, setBusy] = useState(false)
  async function save() {
    const currentValue = Number(value)
    if (!Number.isFinite(currentValue) || currentValue < 0 || busy) return
    setBusy(true)
    try { await store.updateGoalTarget(target.id, { currentValue }); setEditing(false); toast.success('Measure updated') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update Measure') }
    finally { setBusy(false) }
  }
  async function remove() {
    if (!window.confirm(`Delete the Measure “${target.label}”?`)) return
    try { await store.deleteGoalTarget(target.id); toast.success('Measure deleted') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not delete Measure') }
  }
  return <LedgerRow className="flex items-center justify-between gap-3 py-2"><div className="min-w-0"><p className="truncate text-sm">{target.label}</p><LedgerMeta className="mt-1">{target.progressValue}/{target.targetValue} {target.unit} · {target.progressSource === 'manual' ? 'manual' : 'derived'}</LedgerMeta></div><div className="flex shrink-0 items-center gap-1"><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for Measure ${target.label}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{target.progressSource === 'manual' && <DropdownMenuItem onSelect={() => { setValue(String(target.currentValue)); setEditing(true) }}>Edit current value</DropdownMenuItem>}<DropdownMenuItem variant="destructive" onSelect={() => void remove()}><Trash2 className="h-4 w-4" /> Delete Measure</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><Dialog open={editing} onOpenChange={setEditing}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Edit Measure</DialogTitle><DialogDescription>{target.label}</DialogDescription></DialogHeader><FormField label="Current value" required><Input type="number" min={0} value={value} onChange={(event) => setValue(event.target.value)} /></FormField><DialogFooter><Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button onClick={() => void save()} disabled={busy}>Save changes</Button></DialogFooter></DialogContent></Dialog></LedgerRow>
}

function BlockerRow({ problem, linkedStepTitle }: { problem: GoalProblem; linkedStepTitle: string | null }) {
  const [editing, setEditing] = useState(false)
  const [statement, setStatement] = useState(problem.statement)
  const [evidence, setEvidence] = useState(problem.evidence ?? '')
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!statement.trim() || busy) return
    setBusy(true)
    try { await store.updateGoalProblem(problem.id, { statement: statement.trim(), evidence: evidence.trim() || null }); setEditing(false); toast.success('Blocker updated') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update Blocker') }
    finally { setBusy(false) }
  }
  async function remove() {
    if (!window.confirm(`Archive the blocker “${problem.statement}”?`)) return
    try { await store.deleteGoalProblem(problem.id); toast.success('Blocker archived') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not archive Blocker') }
  }
  return <LedgerRow className="flex items-center justify-between gap-3 py-2"><div className="min-w-0"><p className={cn('truncate text-sm', problem.status === 'solved' && 'text-muted-foreground line-through')}>{problem.statement}</p>{linkedStepTitle && <LedgerMeta className="mt-1 truncate">Linked Step · {linkedStepTitle}</LedgerMeta>}</div><div className="flex shrink-0 items-center gap-1"><Button size="sm" variant="ghost" onClick={() => void store.updateGoalProblem(problem.id, { status: problem.status === 'solved' ? 'open' : 'solved' })}>{problem.status === 'solved' ? 'Reopen' : 'Resolve'}</Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for blocker ${problem.statement}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { setStatement(problem.statement); setEvidence(problem.evidence ?? ''); setEditing(true) }}>Edit blocker</DropdownMenuItem><DropdownMenuItem variant="destructive" onSelect={() => void remove()}><Archive className="h-4 w-4" /> Archive blocker</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><Dialog open={editing} onOpenChange={setEditing}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Edit Blocker</DialogTitle><DialogDescription>Keep the obstacle specific enough to act on.</DialogDescription></DialogHeader><div className="space-y-5"><FormField label="Blocker" required><Input value={statement} onChange={(event) => setStatement(event.target.value)} /></FormField><FormField label="Evidence" hint="Optional"><Textarea rows={3} value={evidence} onChange={(event) => setEvidence(event.target.value)} /></FormField></div><DialogFooter><Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button onClick={() => void save()} disabled={busy || !statement.trim()}>Save changes</Button></DialogFooter></DialogContent></Dialog></LedgerRow>
}

function ActionsPanelV2({ goal }: { goal: Goal }) {
  return <div className="space-y-4"><ActionRows goal={goal} /><ActionComposer goal={goal} /></div>
}

function ActionRows({ goal }: { goal: Goal }) {
  const { goals } = useGoals()
  const [editingAction, setEditingAction] = useState<GoalAction | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editMinutes, setEditMinutes] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editContext, setEditContext] = useState('')
  const [editDone, setEditDone] = useState('')
  const [editSubdepartment, setEditSubdepartment] = useState('')
  const actions = [...goal.actions].filter((action) => !['cancelled', 'archived'].includes(action.status)).sort((a, b) => statusOrder(a.status) - statusOrder(b.status))
  const plannedCount = goals.flatMap((item) => item.actions).filter((action) => action.status === 'today' || action.status === 'in_progress').length
  async function updateStatus(id: string, status: 'today' | 'backlog') {
    try { await store.updateGoalAction(id, { status }); toast.success(status === 'today' ? 'Step planned for Today' : 'Step moved to backlog') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update Step') }
  }
  async function start(action: GoalAction) {
    try { await store.startSession(action.id); toast.success('Session started') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not start Session') }
  }
  function edit(action: GoalAction) {
    setEditingAction(action); setEditTitle(action.title); setEditMinutes(String(action.plannedMinutes)); setEditDueDate(action.dueDate ?? ''); setEditContext(action.context); setEditDone(action.definitionOfDone ?? ''); setEditSubdepartment(action.subdepartmentId ?? '')
  }
  async function saveEdit() {
    if (!editingAction || !editTitle.trim()) return
    try { await store.updateGoalAction(editingAction.id, { title: editTitle.trim(), plannedMinutes: Math.min(720, Math.max(1, Math.round(Number(editMinutes)))), dueDate: editDueDate || null, context: editContext.trim() || 'deep', definitionOfDone: editDone.trim() || null, subdepartmentId: editSubdepartment || null }); setEditingAction(null); toast.success('Step updated') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update Step') }
  }
  async function archive(action: GoalAction) {
    if (!window.confirm(`Archive the Step “${action.title}”? You can restore it from Settings → Archived and deleted.`)) return
    try { await store.deleteGoalAction(action.id); toast.success('Step archived') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not archive Step') }
  }
  return <><div className="space-y-2">{actions.map((action) => { const loggedMinutes = actionLoggedMinutes(action); return <LedgerRow key={action.id} className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className={cn('text-sm font-medium leading-5', action.status === 'completed' && 'text-muted-foreground line-through')}>{action.title}</p><LedgerMeta className="mt-1 truncate">{action.plannedMinutes}m{action.dueDate ? ` · due ${action.dueDate}` : ''} · {actionStatusLabel(action.status)}{loggedMinutes > 0 ? ` · ${formatMinutes(loggedMinutes)} logged` : ''}</LedgerMeta>{action.definitionOfDone && <p className="mt-2 text-xs leading-5 text-muted-foreground">Expected: {action.definitionOfDone}</p>}</div><div className="flex shrink-0 gap-1">{action.status === 'today' && <Button size="sm" onClick={() => void start(action)}><Play className="h-3.5 w-3.5" /> Start</Button>}{action.status === 'in_progress' && <Button size="sm" variant="outline" disabled><Pause className="h-3.5 w-3.5" /> Running</Button>}{action.status === 'backlog' && <Button size="sm" variant="outline" disabled={plannedCount >= 3} onClick={() => void updateStatus(action.id, 'today')}>Plan Today</Button>}{action.status === 'today' && <Button size="sm" variant="ghost" onClick={() => void updateStatus(action.id, 'backlog')}>Backlog</Button>}{!['completed', 'cancelled'].includes(action.status) && <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for Step ${action.title}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => edit(action)}>Edit Step</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => void archive(action)}><Archive className="h-4 w-4" /> Archive Step</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</div></LedgerRow> })}</div><Dialog open={Boolean(editingAction)} onOpenChange={(open) => { if (!open) setEditingAction(null) }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Edit Step</DialogTitle></DialogHeader><div className="space-y-5"><FormField label="Step" required><Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /></FormField><div className="grid gap-5 sm:grid-cols-2"><FormField label="Minutes" required><Input type="number" min={1} max={720} value={editMinutes} onChange={(event) => setEditMinutes(event.target.value)} /></FormField><FormField label="Due" hint="Optional"><Input type="date" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} /></FormField></div><div className="grid gap-5 sm:grid-cols-2"><FormField label="Area category" hint="Optional"><select value={editSubdepartment} onChange={(event) => setEditSubdepartment(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">Area only</option>{goal.department.subdepartments.map((subdepartment) => <option key={subdepartment.id} value={subdepartment.id}>{subdepartment.name}</option>)}</select></FormField><FormField label="Context"><Input value={editContext} onChange={(event) => setEditContext(event.target.value)} /></FormField></div><FormField label="Expected result" hint="Optional"><Textarea rows={3} value={editDone} onChange={(event) => setEditDone(event.target.value)} /></FormField></div><DialogFooter><Button variant="ghost" onClick={() => setEditingAction(null)}>Cancel</Button><Button onClick={() => void saveEdit()} disabled={!editTitle.trim()}>Save changes</Button></DialogFooter></DialogContent></Dialog></>
}

function ActionComposer({ goal }: { goal: Goal }) {
  const { goals } = useGoals()
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState('25')
  const [destination, setDestination] = useState<'today' | 'backlog'>('today')
  const [moreOptions, setMoreOptions] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [context, setContext] = useState('deep')
  const [expectedResult, setExpectedResult] = useState('')
  const [subdepartmentId, setSubdepartmentId] = useState('')
  const [busy, setBusy] = useState(false)
  const plannedCount = goals.flatMap((item) => item.actions).filter((action) => action.status === 'today' || action.status === 'in_progress').length
  const queueFull = destination === 'today' && plannedCount >= 3
  async function add() { if (busy || !title.trim() || Number(minutes) <= 0 || queueFull) return; setBusy(true); try { await store.addGoalAction({ goalId: goal.id, title: title.trim(), definitionOfDone: expectedResult.trim() || null, plannedMinutes: Number(minutes), context: context.trim() || 'deep', dueDate: dueDate || null, subdepartmentId: subdepartmentId || null, status: destination }); setTitle(''); setExpectedResult(''); toast.success(destination === 'today' ? "Step added to Today's queue" : 'Step saved to backlog') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add Step') } finally { setBusy(false) } }
  return <div className="work-add-step"><div className="flex items-center justify-between gap-3"><LedgerSectionLabel>Add a Step</LedgerSectionLabel><span className="text-xs text-muted-foreground">{Math.min(plannedCount, 3)}/3 Today slots</span></div><div className="mt-5 space-y-5"><div className="grid gap-5 sm:grid-cols-[1fr_110px]"><FormField label="Step" required><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Concrete work to do" /></FormField><FormField label="Minutes" required><Input type="number" min={1} max={720} value={minutes} onChange={(event) => setMinutes(event.target.value)} /></FormField></div><div className="space-y-2"><span className="block text-xs font-medium">When</span><div className="flex flex-wrap gap-2" role="group" aria-label="Step destination"><Button type="button" size="sm" variant={destination === 'today' ? 'default' : 'outline'} onClick={() => setDestination('today')} aria-pressed={destination === 'today'}>Today</Button><Button type="button" size="sm" variant={destination === 'backlog' ? 'default' : 'outline'} onClick={() => setDestination('backlog')} aria-pressed={destination === 'backlog'}>Backlog</Button></div>{queueFull && <p className="text-xs text-muted-foreground">Today is full. Choose Backlog or move a Step before committing another.</p>}</div><button type="button" className="text-left text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setMoreOptions((open) => !open)} aria-expanded={moreOptions}>{moreOptions ? 'Fewer options' : 'More options'}</button>{moreOptions && <div className="grid gap-5 border-t border-border/70 pt-5 sm:grid-cols-2"><FormField label="Area category" hint="Optional"><select value={subdepartmentId} onChange={(event) => setSubdepartmentId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">Area only</option>{goal.department.subdepartments.map((subdepartment) => <option key={subdepartment.id} value={subdepartment.id}>{subdepartment.name}</option>)}</select></FormField><FormField label="Due" hint="Optional"><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></FormField><FormField label="Context"><Input value={context} onChange={(event) => setContext(event.target.value)} placeholder="deep" /></FormField><FormField label="Expected result" hint="Optional"><Textarea rows={2} value={expectedResult} onChange={(event) => setExpectedResult(event.target.value)} placeholder="What should exist after this Step?" /></FormField></div>}<Button onClick={() => void add()} disabled={busy || !title.trim() || Number(minutes) <= 0 || queueFull}><Plus className="h-4 w-4" /> {busy ? 'Adding…' : 'Add Step'}</Button></div></div>
}

function ActionsPanelLegacyV2({ goal }: { goal: Goal }) {
  const { goals } = useGoals()
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState('25')
  const [destination, setDestination] = useState<'today' | 'backlog'>('today')
  const [moreOptions, setMoreOptions] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [context, setContext] = useState('deep')
  const [expectedResult, setExpectedResult] = useState('')
  const [subdepartmentId, setSubdepartmentId] = useState('')
  const [busy, setBusy] = useState(false)
  const plannedCount = goals.flatMap((item) => item.actions).filter((action) => action.status === 'today' || action.status === 'in_progress').length
  const queueFull = destination === 'today' && plannedCount >= 3

  async function add() {
    if (busy || !title.trim() || Number(minutes) <= 0 || queueFull) return
    setBusy(true)
    try {
      await store.addGoalAction({ goalId: goal.id, title: title.trim(), definitionOfDone: expectedResult.trim() || null, plannedMinutes: Number(minutes), context: context.trim() || 'deep', dueDate: dueDate || null, subdepartmentId: subdepartmentId || null, status: destination })
      setTitle('')
      setExpectedResult('')
      toast.success(destination === 'today' ? "Step added to Today's queue" : 'Step saved to backlog')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add Step') } finally { setBusy(false) }
  }

  return <div className="work-add-step"><div className="flex items-center justify-between gap-3"><LedgerSectionLabel>Add a Step</LedgerSectionLabel><span className="text-xs text-muted-foreground">{Math.min(plannedCount, 3)}/3 Today slots</span></div><div className="mt-5 space-y-5"><div className="grid gap-5 sm:grid-cols-[1fr_110px]"><FormField label="Step" required><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Concrete work to do" /></FormField><FormField label="Minutes" required><Input type="number" min={1} max={720} value={minutes} onChange={(event) => setMinutes(event.target.value)} /></FormField></div><div className="space-y-2"><span className="block text-xs font-medium">When</span><div className="flex flex-wrap gap-2" role="group" aria-label="Step destination"><Button type="button" size="sm" variant={destination === 'today' ? 'default' : 'outline'} onClick={() => setDestination('today')} aria-pressed={destination === 'today'}>Today</Button><Button type="button" size="sm" variant={destination === 'backlog' ? 'default' : 'outline'} onClick={() => setDestination('backlog')} aria-pressed={destination === 'backlog'}>Backlog</Button></div>{queueFull && <p className="text-xs text-muted-foreground">Today is full. Choose Backlog or move a Step before committing another.</p>}</div><button type="button" className="text-left text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setMoreOptions((open) => !open)} aria-expanded={moreOptions}>{moreOptions ? 'Fewer options' : 'More options'}</button>{moreOptions && <div className="grid gap-5 border-t border-border/70 pt-5 sm:grid-cols-2"><FormField label="Area category" hint="Optional"><select value={subdepartmentId} onChange={(event) => setSubdepartmentId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">Area only</option>{goal.department.subdepartments.map((subdepartment) => <option key={subdepartment.id} value={subdepartment.id}>{subdepartment.name}</option>)}</select></FormField><FormField label="Due" hint="Optional"><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></FormField><FormField label="Context"><Input value={context} onChange={(event) => setContext(event.target.value)} placeholder="deep" /></FormField><FormField label="Expected result" hint="Optional"><Textarea rows={2} value={expectedResult} onChange={(event) => setExpectedResult(event.target.value)} placeholder="What should exist after this Step?" /></FormField></div>}<Button onClick={() => void add()} disabled={busy || !title.trim() || Number(minutes) <= 0 || queueFull}><Plus className="h-4 w-4" /> {busy ? 'Adding…' : 'Add Step'}</Button></div></div>
}

function ActionsPanel({ goal }: { goal: Goal }) {
  const { goals } = useGoals()
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState('25')
  const [dueDate, setDueDate] = useState(toKey(new Date()))
  const [planToday, setPlanToday] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editingAction, setEditingAction] = useState<GoalAction | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editMinutes, setEditMinutes] = useState('')
  const [editContext, setEditContext] = useState('')
  const [editDone, setEditDone] = useState('')
  const plannedCount = goals.flatMap((item) => item.actions).filter((action) => action.status === 'today' || action.status === 'in_progress').length
  const queueFull = planToday && plannedCount >= 3
  async function add() { if (busy || !title.trim() || Number(minutes) <= 0 || queueFull) return; setBusy(true); try { await store.addGoalAction({ goalId: goal.id, title: title.trim(), definitionOfDone: null, plannedMinutes: Number(minutes), context: 'deep', dueDate: dueDate || null, status: planToday ? 'today' : 'backlog' }); setTitle(''); toast.success(planToday ? "Step added to Today's queue" : 'Step saved to backlog') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add Step') } finally { setBusy(false) } }
  async function updateStatus(id: string, status: 'today' | 'backlog') { try { await store.updateGoalAction(id, { status }); toast.success(status === 'today' ? 'Step planned for Today' : 'Step moved to backlog') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update Step') } }
  function edit(action: GoalAction) { setEditingAction(action); setEditTitle(action.title); setEditMinutes(String(action.plannedMinutes)); setEditContext(action.context); setEditDone(action.definitionOfDone ?? '') }
  async function saveEdit() { if (!editingAction || !editTitle.trim()) return; try { await store.updateGoalAction(editingAction.id, { title: editTitle.trim(), plannedMinutes: Math.min(720, Math.max(1, Math.round(Number(editMinutes)))), context: editContext.trim() || 'deep', definitionOfDone: editDone.trim() || null }); setEditingAction(null); toast.success('Step updated') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update Step') } }
  const actions = [...goal.actions].filter((action) => action.status !== 'cancelled').sort((a, b) => statusOrder(a.status) - statusOrder(b.status))
  return <div className="space-y-2">{actions.map((action) => <LedgerRow key={action.id} className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className={cn('text-sm font-medium leading-5', action.status === 'completed' && 'text-muted-foreground line-through')}>{action.title}</p><LedgerMeta className="mt-1 truncate">{action.plannedMinutes}m{action.dueDate ? ` · due ${action.dueDate}` : ''} · {actionStatusLabel(action.status)}</LedgerMeta>{action.definitionOfDone && <p className="mt-2 text-xs leading-5 text-muted-foreground">Done when: {action.definitionOfDone}</p>}</div><div className="flex shrink-0 gap-1">{action.status === 'backlog' && <Button size="sm" variant="outline" onClick={() => void updateStatus(action.id, 'today')}>Plan Today</Button>}{action.status === 'today' && <Button size="sm" variant="ghost" onClick={() => void updateStatus(action.id, 'backlog')}>Backlog</Button>}{!['completed', 'cancelled'].includes(action.status) && <Button size="icon" variant="ghost" aria-label={`Edit ${action.title}`} onClick={() => edit(action)}><MoreHorizontal className="h-4 w-4" /></Button>}</div></LedgerRow>)}<div className="work-add-step"><div className="flex items-center justify-between gap-3"><LedgerSectionLabel>Add a Step</LedgerSectionLabel><span className="text-xs text-muted-foreground">{Math.min(plannedCount, 3)}/3 Today slots</span></div><div className="mt-5 space-y-5"><div className="grid gap-5 sm:grid-cols-[1fr_110px]"><FormField label="Step" required><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Concrete work to do" /></FormField><FormField label="Minutes" required><Input type="number" min={1} max={720} value={minutes} onChange={(event) => setMinutes(event.target.value)} /></FormField></div><div className="flex flex-wrap items-end gap-4"><FormField label="Due"><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></FormField><label className="flex min-h-10 items-center gap-2 pb-1 text-sm"><input type="checkbox" checked={planToday} onChange={(event) => setPlanToday(event.target.checked)} /> Plan for Today</label></div>{queueFull && <p className="text-xs text-muted-foreground">Today is full. Save this Step to backlog or move another Step first.</p>}<Button onClick={() => void add()} disabled={busy || !title.trim() || Number(minutes) <= 0 || queueFull}><Plus className="h-4 w-4" /> Add Step</Button></div></div><Dialog open={Boolean(editingAction)} onOpenChange={(open) => { if (!open) setEditingAction(null) }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Edit Step</DialogTitle><DialogDescription>Keep the next action concrete and easy to resume.</DialogDescription></DialogHeader><div className="space-y-5"><FormField label="Step" required><Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /></FormField><div className="grid gap-5 sm:grid-cols-2"><FormField label="Minutes" required><Input type="number" min={1} max={720} value={editMinutes} onChange={(event) => setEditMinutes(event.target.value)} /></FormField><FormField label="Context"><Input value={editContext} onChange={(event) => setEditContext(event.target.value)} /></FormField></div><FormField label="Expected result" hint="Optional"><Textarea rows={3} value={editDone} onChange={(event) => setEditDone(event.target.value)} /></FormField></div><DialogFooter><Button variant="ghost" onClick={() => setEditingAction(null)}>Cancel</Button><Button onClick={() => void saveEdit()} disabled={!editTitle.trim()}>Save changes</Button></DialogFooter></DialogContent></Dialog></div>
}

function statusOrder(status: string) { return status === 'in_progress' ? 0 : status === 'today' ? 1 : status === 'backlog' ? 2 : 3 }
function actionStatusLabel(status: string) { return status === 'today' ? 'Planned for Today' : status === 'in_progress' ? 'Running' : status === 'completed' ? 'Finished' : 'Backlog' }
function deadlineLabel(days: number) { return days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'due today' : `${days}d remaining` }
