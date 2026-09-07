'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, MoreHorizontal, Pause, Play, RotateCcw, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LedgerMeta, LedgerPanel, LedgerRow, LedgerSectionLabel } from '@/components/quiet-ledger'
import { useGoals, useSprints, store, type FocusSession, type Goal, type GoalAction } from '@/lib/hooks'
import { useUIStore } from '@/store/ui-store'
import { toast } from 'sonner'

type StepItem = { goal: Goal; action: GoalAction }

export function TodayScreen() {
  const { goals, loading } = useGoals()
  const { sprints } = useSprints()
  const openGoal = useUIStore((state) => state.openGoal)
  const [busy, setBusy] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [resizeAction, setResizeAction] = useState<GoalAction | null>(null)
  const [resizeMinutes, setResizeMinutes] = useState('')
  const activeSprint = sprints.find((sprint) => sprint.status === 'active')
  const sprintGoalIds = useMemo(() => new Set(activeSprint?.goals.map((link) => link.goalId) ?? []), [activeSprint])
  const committed: StepItem[] = goals
    .flatMap((goal) => goal.actions.map((action) => ({ goal, action })))
    .filter(({ action }) => action.status === 'today' || action.status === 'in_progress')
    .sort((a, b) => (a.action.todayOrder ?? 99) - (b.action.todayOrder ?? 99))
  const running = committed.flatMap(({ goal, action }) => action.sessions.map((session) => ({ goal, action, session })))
    .find(({ session }) => session.status === 'running')
  const inSprint = activeSprint ? committed.filter(({ goal }) => sprintGoalIds.has(goal.id)) : committed
  const outsideSprint = activeSprint ? committed.filter(({ goal }) => !sprintGoalIds.has(goal.id)) : []
  const compact = inSprint.slice(0, 3)
  const visible = showAll ? inSprint : compact

  async function start(action: GoalAction) {
    setBusy(action.id)
    try {
      await store.startFocusSession(action.id)
      toast.success('Step started')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not start step') }
    finally { setBusy(null) }
  }

  async function resize(action: GoalAction) {
    setResizeAction(action)
    setResizeMinutes(String(Math.min(action.plannedMinutes, 25)))
  }

  async function saveResize() {
    if (!resizeAction) return
    const minutes = Number(resizeMinutes)
    if (!Number.isFinite(minutes) || minutes < 1) {
      toast.error('Enter at least 1 minute')
      return
    }
    const action = resizeAction
    setBusy(action.id)
    try {
      await store.updateGoalAction(action.id, { plannedMinutes: Math.min(720, Math.round(minutes)), status: 'today' })
      toast.success('Step resized')
      setResizeAction(null)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not resize step') }
    finally { setBusy(null) }
  }

  async function moveToBacklog(action: GoalAction) {
    setBusy(action.id)
    try {
      await store.updateGoalAction(action.id, { status: 'backlog' })
      toast.success('Step moved to backlog')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not move step') }
    finally { setBusy(null) }
  }

  if (loading) return <p className="py-12 text-center text-sm text-muted-foreground">Loading work…</p>
  if (!goals.some((goal) => goal.status === 'active')) {
    return <LedgerPanel className="text-center"><Target className="mx-auto h-8 w-8 text-[var(--growth)]" /><LedgerSectionLabel className="mt-3">No active outcomes</LedgerSectionLabel><LedgerMeta className="mt-1">Create an outcome, then add its first step.</LedgerMeta></LedgerPanel>
  }
  if (running) return <RunningSession session={running.session} action={running.action} goalTitle={running.goal.title} />

  const remaining = Math.max(0, inSprint.length - compact.length)
  const openSteps = goals
    .filter((goal) => !activeSprint || sprintGoalIds.has(goal.id))
    .filter((goal) => !['completed', 'abandoned'].includes(goal.status))
    .reduce((count, goal) => count + goal.actions.filter((action) => !['completed', 'cancelled'].includes(action.status)).length, 0)
  const committedMinutes = inSprint.reduce((sum, item) => sum + item.action.plannedMinutes, 0)
  const rowProps = { busy, onStart: start, onResize: resize, onBacklog: moveToBacklog }
  return (
    <>
      <LedgerPanel className="border-[var(--growth)]/35">
      <div className="flex items-baseline justify-between gap-4">
        <div><LedgerSectionLabel>Committed steps</LedgerSectionLabel><LedgerMeta className="mt-1">{activeSprint ? `Only steps in ${activeSprint.name}` : 'Your next executable work'}</LedgerMeta><LedgerMeta className="mt-1">{inSprint.length} committed of {openSteps} open steps</LedgerMeta></div>
        <div className="text-right"><p className="text-sm tabular-nums text-foreground">{committedMinutes}m</p><LedgerMeta>planned</LedgerMeta></div>
      </div>
      <div className="mt-4 space-y-3">
        {visible.length === 0 ? (
          <div className="py-6 text-center"><p className="text-sm text-muted-foreground">{activeSprint ? 'No steps are committed in this Sprint.' : 'No steps are committed yet.'}</p>{activeSprint?.goals[0] && <Button className="mt-3" variant="outline" onClick={() => openGoal(activeSprint.goals[0].goalId)}>Add a step</Button>}</div>
        ) : visible.map((item) => <StepRow key={item.action.id} item={item} {...rowProps} />)}
      </div>
      {remaining > 0 && <Button variant="ghost" size="sm" className="mt-3 px-0 text-muted-foreground" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Show first 3 steps' : `Show ${remaining} more committed step${remaining === 1 ? '' : 's'}`}</Button>}
      {outsideSprint.length > 0 && (
        <details className="mt-4 border-t border-border pt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground">Outside Sprint · {outsideSprint.length}</summary>
          <div className="mt-3 space-y-3">{outsideSprint.map((item) => <StepRow key={item.action.id} item={item} outsideSprint {...rowProps} />)}</div>
        </details>
      )}
      </LedgerPanel>
      <Dialog open={Boolean(resizeAction)} onOpenChange={(open) => { if (!open && !busy) setResizeAction(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Resize step</DialogTitle><DialogDescription>Adjust the planned time without leaving the committed queue.</DialogDescription></DialogHeader>
          <div><Label htmlFor="resize-minutes">Planned minutes</Label><Input id="resize-minutes" type="number" min={1} max={720} value={resizeMinutes} onChange={(event) => setResizeMinutes(event.target.value)} /></div>
          <DialogFooter><Button variant="ghost" onClick={() => setResizeAction(null)} disabled={Boolean(busy)}>Cancel</Button><Button onClick={saveResize} disabled={Boolean(busy)}>Save changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function StepRow({ item: { goal, action }, busy, outsideSprint = false, onStart, onResize, onBacklog }: {
  item: StepItem; busy: string | null; outsideSprint?: boolean
  onStart: (action: GoalAction) => void; onResize: (action: GoalAction) => void; onBacklog: (action: GoalAction) => void
}) {
  return (
    <LedgerRow className="flex items-center gap-3">
      <div className="min-w-0 flex-1"><p className="text-sm font-medium leading-5">{action.title}</p><LedgerMeta className="mt-1 truncate">{goal.title} · {action.plannedMinutes}m{outsideSprint ? ' · Outside Sprint' : ''}</LedgerMeta></div>
      <Button size="sm" onClick={() => onStart(action)} disabled={busy === action.id}><Play className="h-3.5 w-3.5" /> Start step</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`More options for ${action.title}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onResize(action)}><RotateCcw /> Resize step</DropdownMenuItem><DropdownMenuItem onSelect={() => onBacklog(action)}><Clock3 /> Move to backlog</DropdownMenuItem></DropdownMenuContent>
      </DropdownMenu>
    </LedgerRow>
  )
}

function RunningSession({ session, action, goalTitle }: { session: FocusSession; action: GoalAction; goalTitle: string }) {
  const [now, setNow] = useState(Date.now())
  const elapsed = Math.max(1, Math.round((now - new Date(session.startedAt).getTime()) / 60_000))
  const [minutes, setMinutes] = useState(String(elapsed))
  const [output, setOutput] = useState('')
  const [friction, setFriction] = useState('')
  const [finishing, setFinishing] = useState(false)
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 10_000); return () => window.clearInterval(timer) }, [])

  async function finish(outcome: 'completed' | 'interrupted' | 'abandoned') {
    setFinishing(true)
    try {
      await store.finishFocusSession({ sessionId: session.id, actualMinutes: Math.max(1, Number(minutes)), output, friction, outcome })
      toast.success(outcome === 'completed' ? 'Step finished. Proof recorded.' : outcome === 'interrupted' ? 'Step kept committed.' : 'Step moved to backlog.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not finish step') }
    finally { setFinishing(false) }
  }

  return (
    <LedgerPanel className="border-[var(--growth)]/60 shadow-[0_0_35px_rgba(251,191,36,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><p className="flex items-center gap-2 text-sm font-medium text-[var(--growth)]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--growth)]" /> Session in progress</p><h2 className="mt-2 text-xl font-semibold leading-7">{action.title}</h2><LedgerMeta className="mt-1">{goalTitle}</LedgerMeta></div>
        <div className="text-right"><p className="ledger-metric text-4xl">{elapsed}m</p><LedgerMeta>{Math.max(0, action.plannedMinutes - elapsed)}m left</LedgerMeta></div>
      </div>
      {action.definitionOfDone && <LedgerRow className="mt-4 border-[var(--growth)]/20 bg-[var(--growth)]/8 text-sm"><CheckCircle2 className="mr-2 inline h-4 w-4" />{action.definitionOfDone}</LedgerRow>}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[var(--growth)] transition-all" style={{ width: `${Math.min(100, (elapsed / Math.max(1, action.plannedMinutes)) * 100)}%` }} /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[110px_1fr]">
        <div><Label>Actual minutes</Label><Input type="number" min={1} max={720} value={minutes} onChange={(event) => setMinutes(event.target.value)} /></div>
        <div><div className="flex items-center justify-between"><Label htmlFor="proof">Proof of completion</Label><span className="text-xs text-[var(--depreciation)]">Required</span></div><Input id="proof" value={output} onChange={(event) => setOutput(event.target.value)} placeholder="One line of proof this happened" /></div>
      </div>
      <div className="mt-3"><Label>Friction or interruption <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea value={friction} onChange={(event) => setFriction(event.target.value)} rows={2} /></div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => finish('completed')} disabled={finishing || !output.trim()}><CheckCircle2 className="h-4 w-4" /> Finish step</Button>
        <Button variant="outline" onClick={() => finish('interrupted')} disabled={finishing}><Pause className="h-4 w-4" /> Keep step committed</Button>
        <Button variant="ghost" onClick={() => finish('abandoned')} disabled={finishing}><Clock3 className="h-4 w-4" /> Move step to backlog</Button>
      </div>
    </LedgerPanel>
  )
}
