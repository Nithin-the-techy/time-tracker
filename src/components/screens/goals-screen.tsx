'use client'

import { useEffect, useState } from 'react'
import { Archive, ArrowLeft, Check, CirclePlus, MoreHorizontal, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FormField, LedgerMeta, LedgerPanel, LedgerRow, LedgerSectionLabel } from '@/components/quiet-ledger'
import { useDepartments, useGoals, useSprints, store, type Department, type Goal, type GoalAction } from '@/lib/hooks'
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

  return <div className="work-screen mx-auto max-w-[1680px] overflow-x-hidden pb-12">
    <header className="work-page-head"><h1 className="ledger-page-title">Work</h1></header>
    <div className="work-layout">
      <main className="min-w-0">{running ? <RunningSession session={running.session} action={running.action} goalTitle={running.goal.title} availableSteps={goals.flatMap((goal) => goal.actions.filter((action) => (action.status === 'today' || action.status === 'in_progress') && action.id !== running.action.id).map((action) => ({ action, goalTitle: goal.title })))} /> : activeGoal ? <GoalWorkbench goal={activeGoal} onBack={closeGoal} /> : <TodayScreen />}</main>
      <aside className="work-rail" aria-label="Work navigation"><SprintPanel /><OutcomeNavigator goals={visibleGoals} departments={departments} sprints={visibleSprints} loading={loading} onOpenGoal={openGoal} /></aside>
    </div>
  </div>
}

function areaName(department: Department) { return department.name.replace('Department of ', '') }

function goalAreaLabel(goal: Goal) {
  const areas = goal.departments?.map((membership) => areaName(membership.department))
  return (areas && areas.length > 0 ? areas : [areaName(goal.department)]).join(' · ')
}

function OutcomeNavigator({ goals, departments, sprints, loading, onOpenGoal }: { goals: Goal[]; departments: ReturnType<typeof useDepartments>['departments']; sprints: ReturnType<typeof useSprints>['sprints']; loading: boolean; onOpenGoal: (id: string) => void }) {
  const activeSprint = sprints.find((sprint) => sprint.status === 'active')
  const goalById = new Map(goals.map((goal) => [goal.id, goal]))
  const activeGoalIds = new Set(activeSprint?.goals.map((link) => link.goalId) ?? [])
  const outside = goals.filter((goal) => !activeGoalIds.has(goal.id))
  const renderGoal = (goal: Goal) => {
    const info = goalProgressInfo(goal)
    const progressLabel = info.ratio !== null && info.totalSteps > 0 ? `${info.label} · ${info.completedSteps} of ${info.totalSteps} Steps` : info.label
    return <button key={goal.id} type="button" onClick={() => onOpenGoal(goal.id)} className="work-outcome-row group w-full text-left"><span className={cn('work-outcome-marker', info.ratio === null ? 'bg-muted-foreground/40' : info.ratio >= 1 ? 'bg-[var(--growth)]' : 'bg-[var(--growth)]/70')} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{goal.title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{goalAreaLabel(goal)} · {progressLabel}</span>{info.ratio !== null && <span className="mt-2 block h-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-[var(--growth)]" style={{ width: `${info.ratio * 100}%` }} /></span>}</span><span className="ml-2 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true">›</span></button>
  }
  return <section className="space-y-3" aria-labelledby="outcomes-heading"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-baseline gap-2"><LedgerSectionLabel id="outcomes-heading">Outcomes</LedgerSectionLabel><span className="text-xs tabular-nums text-muted-foreground">{goals.length}</span></div><CreateOutcomeDialog departments={departments} sprints={sprints} activeSprintId={activeSprint?.id ?? null} /></div>{loading ? <div className="space-y-3"><div className="h-12 animate-pulse rounded-md bg-muted/20" /><div className="h-12 animate-pulse rounded-md bg-muted/20" /></div> : goals.length === 0 ? <div className="work-empty-rail"><p className="text-sm font-medium">No Outcomes yet.</p></div> : <div className="divide-y divide-border/70">{activeSprint?.goals.map((link) => goalById.get(link.goalId)).filter((goal): goal is Goal => Boolean(goal)).map(renderGoal)}{outside.length > 0 && <><div className="mt-4 border-t border-border/70 pt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Outside current Sprint</div>{outside.map(renderGoal)}</>}</div>}</section>
}

function AreaPicker({ departments, selectedIds, onChange }: { departments: Department[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((value) => value !== id))
    else onChange([...selectedIds, id])
  }
  return <fieldset className="space-y-2"><legend className="text-xs font-medium leading-5 text-foreground">Areas <span className="ml-1 text-[var(--growth)]" aria-hidden="true">*</span></legend><div className="grid gap-2 sm:grid-cols-2">{departments.map((department) => { const selected = selectedIds.includes(department.id); return <label key={department.id} className={cn('flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors', selected ? 'border-[var(--growth)]/60 bg-[var(--growth)]/10 text-foreground' : 'border-input bg-card text-muted-foreground hover:border-foreground/30')}><input type="checkbox" className="sr-only" checked={selected} onChange={() => toggle(department.id)} /><span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[11px]', selected ? 'border-[var(--growth)] bg-[var(--growth)] text-[var(--ink)]' : 'border-muted-foreground/50')}>{selected ? '✓' : ''}</span><span className="truncate">{areaName(department)}</span></label>})}</div><p className="text-xs leading-4 text-muted-foreground">Choose every Area this Outcome belongs to.</p></fieldset>
}

function CreateOutcomeDialog({ departments, sprints, activeSprintId }: { departments: ReturnType<typeof useDepartments>['departments']; sprints: ReturnType<typeof useSprints>['sprints']; activeSprintId: string | null }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [departmentIds, setDepartmentIds] = useState<string[]>([])
  const [sprintId, setSprintId] = useState(activeSprintId ?? '')
  const [targetDate, setTargetDate] = useState(toKey(addDays(new Date(), 14)))
  const [busy, setBusy] = useState(false)
  const today = toKey(new Date())
  async function create() {
    if (departmentIds.length < 1 || !title.trim() || busy) return
    setBusy(true)
    try { await store.createGoal({ departmentId: departmentIds[0], departmentIds, title: title.trim(), outcome: title.trim(), startDate: today, targetDate, sprintId: sprintId || null }); setTitle(''); setDepartmentIds([]); setOpen(false); toast.success('Outcome created') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create Outcome') }
    finally { setBusy(false) }
  }
  function openDialog() { setSprintId(activeSprintId ?? ''); setDepartmentIds(departments[0] ? [departments[0].id] : []); setTargetDate(toKey(addDays(new Date(), 14))); setOpen(true) }
  return <><Button variant="outline" size="sm" onClick={openDialog}><CirclePlus className="h-4 w-4" /> Add Outcome</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Add an Outcome</DialogTitle></DialogHeader><div className="space-y-5"><FormField label="Outcome" required><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Publish the literature review" /></FormField><AreaPicker departments={departments} selectedIds={departmentIds} onChange={setDepartmentIds} /><div className="grid gap-5 sm:grid-cols-2"><FormField label="Due" required><Input type="date" min={today} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></FormField><FormField label="Sprint"><select value={sprintId} onChange={(event) => setSprintId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">Outside current Sprint</option>{sprints.filter((sprint) => sprint.status !== 'archived').map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select></FormField></div></div><DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void create()} disabled={busy || !title.trim() || departmentIds.length === 0}>{busy ? 'Creating…' : 'Create Outcome'}</Button></DialogFooter></DialogContent></Dialog></>
}

function GoalWorkbench({ goal, onBack }: { goal: Goal; onBack: () => void }) {
  const { sprints } = useSprints()
  const { departments } = useDepartments()
  const [editOpen, setEditOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveSprintId, setMoveSprintId] = useState('')
  const [title, setTitle] = useState(goal.title)
  const [editDepartmentIds, setEditDepartmentIds] = useState<string[]>([])
  const [editTargetDate, setEditTargetDate] = useState(goal.targetDate)
  const [editSprintId, setEditSprintId] = useState('')
  const info = goalProgressInfo(goal)
  const loggedMinutes = goalLoggedMinutes(goal)
  const currentDepartmentIds = goal.departmentIds ?? goal.departments?.map((membership) => membership.department.id) ?? [goal.departmentId]

  function openEdit() { setTitle(goal.title); setEditDepartmentIds(currentDepartmentIds); setEditTargetDate(goal.targetDate); setEditSprintId(currentSprintId); setEditOpen(true) }
  async function save() {
    if (!title.trim() || editDepartmentIds.length < 1 || !editTargetDate) return
    if (editTargetDate < goal.startDate) { toast.error('Due date must be on or after the start date'); return }
    try {
      await store.updateGoal(goal.id, { title: title.trim(), outcome: goal.outcome === goal.title ? title.trim() : goal.outcome, departmentIds: editDepartmentIds, targetDate: editTargetDate })
      if (editSprintId !== currentSprintId) await store.setGoalSprint(goal.id, editSprintId || null)
      setEditOpen(false)
      toast.success('Outcome updated')
    }
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
  const currentSprintId = sprints.find((sprint) => sprint.goals.some((link) => link.goalId === goal.id))?.id ?? ''
  const openMoveDialog = () => { setMoveSprintId(currentSprintId); setMoveOpen(true) }
  async function saveMove() {
    try { await store.setGoalSprint(goal.id, moveSprintId || null); setMoveOpen(false); toast.success(moveSprintId ? 'Outcome moved' : 'Outcome outside current Sprint') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not move Outcome') }
  }
  return <div className="space-y-6"><div className="flex items-center justify-between gap-3"><button type="button" onClick={onBack} className="inline-flex min-h-8 items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to Today</button></div><LedgerPanel className="work-outcome-head p-5 md:p-6"><div className="flex items-start justify-between gap-6"><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{goalAreaLabel(goal)} · {deadlineLabel(daysRemaining(goal.targetDate))}</p><h2 className="ledger-page-title mt-2 text-2xl md:text-[28px]">{goal.title}</h2>{goal.outcome !== goal.title && <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{goal.outcome}</p>}</div><div className="shrink-0 text-right">{info.ratio !== null ? <><p className="ledger-metric text-4xl tabular-nums text-[var(--growth)]">{Math.round(info.ratio * 100)}%</p><p className="text-xs text-muted-foreground">{goal.targets.length} Measure{goal.targets.length === 1 ? '' : 's'}</p></> : info.totalSteps > 0 ? <><p className="ledger-metric text-2xl tabular-nums">{info.completedSteps}/{info.totalSteps}</p><p className="text-xs text-muted-foreground">Steps done</p></> : <p className="text-sm text-muted-foreground">No progress measure yet</p>}<p className="mt-2 text-xs tabular-nums text-muted-foreground">{formatMinutes(loggedMinutes)} logged</p></div></div>{info.ratio !== null && <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[var(--growth)]" style={{ width: `${info.ratio * 100}%` }} /></div>}<div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={openEdit}>Edit Outcome</Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Outcome actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => void store.updateGoal(goal.id, { status: goal.status === 'active' ? 'paused' : 'active' })}>{goal.status === 'active' ? <><Pause className="h-4 w-4" /> Pause Outcome</> : <><Play className="h-4 w-4" /> Resume Outcome</>}</DropdownMenuItem>{goal.status !== 'completed' && <DropdownMenuItem onSelect={() => void store.updateGoal(goal.id, { status: 'completed' })}><Check className="h-4 w-4" /> Complete Outcome</DropdownMenuItem>}<DropdownMenuItem onSelect={openMoveDialog}>Move Outcome</DropdownMenuItem><DropdownMenuItem onSelect={() => void archive()}><Archive className="h-4 w-4" /> Archive Outcome</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => void remove()}><Trash2 className="h-4 w-4" /> Delete Outcome</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></LedgerPanel><section className="space-y-3"><div className="flex items-baseline justify-between gap-3"><LedgerSectionLabel>Steps</LedgerSectionLabel><span className="text-xs tabular-nums text-muted-foreground">{info.completedSteps} of {info.totalSteps} done · {goal.actions.filter((action) => action.status !== 'cancelled').length} total</span></div><ActionsPanelV2 goal={goal} /></section><Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Edit an Outcome</DialogTitle></DialogHeader><div className="space-y-5"><FormField label="Outcome" required><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Publish the literature review" /></FormField><AreaPicker departments={departments} selectedIds={editDepartmentIds} onChange={setEditDepartmentIds} /><div className="grid gap-5 sm:grid-cols-2"><FormField label="Due" required><Input type="date" min={goal.startDate} value={editTargetDate} onChange={(event) => setEditTargetDate(event.target.value)} /></FormField><FormField label="Sprint"><select value={editSprintId} onChange={(event) => setEditSprintId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">Outside current Sprint</option>{sprints.filter((sprint) => sprint.status !== 'archived').map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select></FormField></div></div><DialogFooter><Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => void save()} disabled={!title.trim() || editDepartmentIds.length === 0 || !editTargetDate}>Save changes</Button></DialogFooter></DialogContent></Dialog><Dialog open={moveOpen} onOpenChange={setMoveOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Move Outcome</DialogTitle></DialogHeader><FormField label="Sprint" required><select value={moveSprintId} onChange={(event) => setMoveSprintId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">Outside current Sprint</option>{sprints.filter((sprint) => sprint.status !== 'archived').map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select></FormField><DialogFooter><Button variant="ghost" onClick={() => setMoveOpen(false)}>Cancel</Button><Button onClick={() => void saveMove()}>Save</Button></DialogFooter></DialogContent></Dialog></div>
}

function ActionsPanelV2({ goal }: { goal: Goal }) {
  return <div className="space-y-4"><ActionRows goal={goal} /><ActionComposer goal={goal} /></div>
}

function ActionRows({ goal }: { goal: Goal }) {
  const { goals } = useGoals()
  const [editingAction, setEditingAction] = useState<GoalAction | null>(null)
  const [editGoalId, setEditGoalId] = useState(goal.id)
  const [editTitle, setEditTitle] = useState('')
  const [editMinutes, setEditMinutes] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const actions = [...goal.actions].filter((action) => !['cancelled', 'archived'].includes(action.status)).sort((a, b) => statusOrder(a.status) - statusOrder(b.status))
  const today = toKey(new Date())
  const activeGoals = goals.filter((item) => !['completed', 'abandoned', 'archived'].includes(item.status))
  async function updateStatus(id: string, status: 'today' | 'backlog' | 'completed') {
    try { await store.updateGoalAction(id, { status }); toast.success(status === 'today' ? 'Step planned for Today' : status === 'completed' ? 'Step completed' : 'Step moved to backlog') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update Step') }
  }
  async function start(action: GoalAction) {
    try { await store.startSession(action.id); toast.success('Session started') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not start Session') }
  }
  function edit(action: GoalAction) {
    setEditingAction(action); setEditGoalId(action.goalId); setEditTitle(action.title); setEditMinutes(String(action.plannedMinutes)); setEditDueDate(action.dueDate ?? (action.status === 'today' ? today : ''))
  }
  async function saveEdit() {
    if (!editingAction || !editGoalId || !editTitle.trim()) return
    const parsedMinutes = Math.round(Number(editMinutes))
    if (!Number.isFinite(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 720) { toast.error('Minutes must be between 1 and 720'); return }
    const nextStatus = editDueDate ? editDueDate === today ? 'today' : 'backlog' : undefined
    const persistedDueDate = editDueDate === today ? null : editDueDate || null
    try { await store.updateGoalAction(editingAction.id, { goalId: editGoalId, title: editTitle.trim(), plannedMinutes: parsedMinutes, dueDate: persistedDueDate, ...(nextStatus ? { status: nextStatus } : {}) }); setEditingAction(null); toast.success('Step updated') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update Step') }
  }
  async function archive(action: GoalAction) {
    if (!window.confirm(`Archive the Step “${action.title}”? You can restore it from Settings → Archived and deleted.`)) return
    try { await store.deleteGoalAction(action.id); toast.success('Step archived') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not archive Step') }
  }
  return <><div className="space-y-2">{actions.map((action) => { const loggedMinutes = actionLoggedMinutes(action); return <LedgerRow key={action.id} className="flex flex-wrap items-start gap-3 rounded-none border-0 border-b border-border/70 bg-transparent p-0 py-3 first:pt-0 last:border-b-0"><div className="min-w-0 flex-1"><p className={cn('text-sm font-medium leading-5', action.status === 'completed' && 'text-muted-foreground line-through')}>{action.title}</p><LedgerMeta className="mt-1 truncate">{action.plannedMinutes}m{action.dueDate ? ` · due ${action.dueDate}` : ''} · {actionStatusLabel(action.status)}{loggedMinutes > 0 ? ` · ${formatMinutes(loggedMinutes)} logged` : ''}</LedgerMeta>{action.definitionOfDone && <p className="mt-2 text-xs leading-5 text-muted-foreground">Expected: {action.definitionOfDone}</p>}</div><div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{action.status === 'today' && <Button size="sm" onClick={() => void start(action)}><Play className="h-3.5 w-3.5" /> Start</Button>}{action.status === 'in_progress' && <Button size="sm" variant="outline" disabled><Pause className="h-3.5 w-3.5" /> Running</Button>}{!['completed', 'in_progress', 'cancelled'].includes(action.status) && <Button size="sm" variant="outline" onClick={() => void updateStatus(action.id, 'completed')}><Check className="h-3.5 w-3.5" /> Complete</Button>}{action.status === 'backlog' && <Button size="sm" variant="ghost" onClick={() => void updateStatus(action.id, 'today')}>Plan Today</Button>}{action.status === 'today' && <Button size="sm" variant="ghost" onClick={() => void updateStatus(action.id, 'backlog')}>Move to backlog</Button>}{!['completed', 'cancelled'].includes(action.status) && <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for Step ${action.title}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => edit(action)}>Edit Step</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => void archive(action)}><Archive className="h-4 w-4" /> Archive Step</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</div></LedgerRow> })}</div><Dialog open={Boolean(editingAction)} onOpenChange={(open) => { if (!open) setEditingAction(null) }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Edit a Step</DialogTitle></DialogHeader><div className="space-y-5"><FormField label="Outcome" required><select value={editGoalId} onChange={(event) => setEditGoalId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">Choose an Outcome</option>{activeGoals.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></FormField><FormField label="Step" required><Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Concrete work to do" /></FormField><div className="grid gap-5 sm:grid-cols-2"><FormField label="Minutes" required><Input type="number" min={1} max={720} value={editMinutes} onChange={(event) => setEditMinutes(event.target.value)} /></FormField><FormField label="Date" required><Input type="date" min={today} value={editDueDate || (editingAction?.status === 'today' ? today : '')} onChange={(event) => setEditDueDate(event.target.value)} /></FormField></div></div><DialogFooter><Button variant="ghost" onClick={() => setEditingAction(null)}>Cancel</Button><Button onClick={() => void saveEdit()} disabled={!editGoalId || !editTitle.trim()}>Save changes</Button></DialogFooter></DialogContent></Dialog></>
}

function ActionComposer({ goal }: { goal: Goal }) {
  const { goals } = useGoals()
  const [open, setOpen] = useState(false)
  const [selectedGoalId, setSelectedGoalId] = useState(goal.id)
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState('25')
  const [plannedDate, setPlannedDate] = useState(toKey(new Date()))
  const [busy, setBusy] = useState(false)
  const today = toKey(new Date())
  const isToday = plannedDate === today
  const activeGoals = goals.filter((item) => !['completed', 'abandoned', 'archived'].includes(item.status))
  async function add() {
    if (busy || !selectedGoalId || !title.trim() || Number(minutes) <= 0) return
    setBusy(true)
    try { await store.addGoalAction({ goalId: selectedGoalId, title: title.trim(), definitionOfDone: null, plannedMinutes: Number(minutes), context: 'deep', dueDate: isToday ? null : plannedDate || null, subdepartmentId: null, status: isToday ? 'today' : 'backlog' }); setTitle(''); setMinutes('25'); setPlannedDate(today); setSelectedGoalId(goal.id); setOpen(false); toast.success(isToday ? "Step added to Today's queue" : 'Step scheduled') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add Step') }
    finally { setBusy(false) }
  }
  function openComposer() { setSelectedGoalId(goal.id); setPlannedDate(today); setOpen(true) }
  return <><div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3"><LedgerSectionLabel>Add a Step</LedgerSectionLabel><Button size="sm" variant="outline" onClick={openComposer}><Plus className="h-4 w-4" /> Add Step</Button></div><Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Add a Step</DialogTitle></DialogHeader><div className="space-y-5"><FormField label="Outcome" required><select value={selectedGoalId} onChange={(event) => setSelectedGoalId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">Choose an Outcome</option>{activeGoals.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></FormField><FormField label="Step" required><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Concrete work to do" /></FormField><div className="grid gap-5 sm:grid-cols-2"><FormField label="Minutes" required><Input type="number" min={1} max={720} value={minutes} onChange={(event) => setMinutes(event.target.value)} /></FormField><FormField label="Date" required><Input type="date" min={today} value={plannedDate} onChange={(event) => setPlannedDate(event.target.value || today)} /></FormField></div></div><DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void add()} disabled={busy || !selectedGoalId || !title.trim() || Number(minutes) <= 0}>{busy ? 'Adding…' : 'Add Step'}</Button></DialogFooter></DialogContent></Dialog></>
}

function statusOrder(status: string) { return status === 'in_progress' ? 0 : status === 'today' ? 1 : status === 'backlog' ? 2 : 3 }
function actionStatusLabel(status: string) { return status === 'today' ? 'Planned for Today' : status === 'in_progress' ? 'Running' : status === 'completed' ? 'Finished' : 'Backlog' }
function deadlineLabel(days: number) { return days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'due today' : `${days}d remaining` }
