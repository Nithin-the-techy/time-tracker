'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, MoreHorizontal, Pause, Play, RotateCcw, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField, LedgerMeta, LedgerPanel, LedgerRow, LedgerSectionLabel } from '@/components/quiet-ledger'
import { useGoals, useSprints, store, type WorkSession, type Goal, type GoalAction } from '@/lib/hooks'
import { actionLoggedMinutes } from '@/lib/goal-metrics'
import { formatMinutes } from '@/lib/metrics'
import { useUIStore } from '@/store/ui-store'
import { toast } from 'sonner'

type StepItem = { goal: Goal; action: GoalAction }
type RecoveryStep = { action: GoalAction; goalTitle: string }

export function findRunningSession(goals: Goal[]) {
  return goals.flatMap((goal) => goal.actions.flatMap((action) => action.sessions.map((session) => ({ goal, action, session })))).find(({ session }) => session.status === 'running') ?? null
}

export function TodayScreen() {
  const { goals, loading } = useGoals()
  const { sprints } = useSprints()
  const openGoal = useUIStore((state) => state.openGoal)
  const [busy, setBusy] = useState<string | null>(null)
  const [resizeAction, setResizeAction] = useState<GoalAction | null>(null)
  const [resizeMinutes, setResizeMinutes] = useState('')
  const activeSprint = sprints.find((sprint) => sprint.status === 'active')
  const sprintGoalIds = useMemo(() => new Set(activeSprint?.goals.map((link) => link.goalId) ?? []), [activeSprint])
  const committed: StepItem[] = goals
    .flatMap((goal) => goal.actions.map((action) => ({ goal, action })))
    .filter(({ action }) => action.status === 'today' || action.status === 'in_progress')
    .sort((a, b) => (a.action.todayOrder ?? 99) - (b.action.todayOrder ?? 99))
  const running = findRunningSession(goals)
  const inSprint = activeSprint ? committed.filter(({ goal }) => sprintGoalIds.has(goal.id)) : committed
  const outsideSprint = activeSprint ? committed.filter(({ goal }) => !sprintGoalIds.has(goal.id)) : []
  const compact = inSprint.slice(0, 3)
  const outsideVisible = outsideSprint.slice(0, Math.max(0, 3 - compact.length))
  const hiddenCount = Math.max(0, committed.length - compact.length - outsideVisible.length)

  async function start(action: GoalAction) {
    setBusy(action.id)
    try {
      await store.startSession(action.id)
      toast.success('Step started')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not start Step') }
    finally { setBusy(null) }
  }

  function resize(action: GoalAction) {
    setResizeAction(action)
    setResizeMinutes(String(action.plannedMinutes))
  }

  async function saveResize() {
    if (!resizeAction) return
    const minutes = Number(resizeMinutes)
    if (!Number.isFinite(minutes) || minutes < 1) { toast.error('Enter at least 1 minute'); return }
    const action = resizeAction
    setBusy(action.id)
    try {
      await store.updateGoalAction(action.id, { plannedMinutes: Math.min(720, Math.round(minutes)), status: 'today' })
      toast.success('Step resized')
      setResizeAction(null)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not resize Step') }
    finally { setBusy(null) }
  }

  async function moveToBacklog(action: GoalAction) {
    setBusy(action.id)
    try { await store.updateGoalAction(action.id, { status: 'backlog' }); toast.success('Step moved to backlog') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update Step') }
    finally { setBusy(null) }
  }

  if (loading) return <LedgerPanel className="work-tier1 min-h-64" aria-label="Loading Today"><p className="text-sm text-muted-foreground">Loading Today…</p></LedgerPanel>
  if (running) return <RunningSession session={running.session} action={running.action} goalTitle={running.goal.title} availableSteps={committed.filter(({ action }) => action.id !== running.action.id).map(({ action, goal }) => ({ action, goalTitle: goal.title }))} />
  if (!goals.some((goal) => goal.status === 'active')) {
    return <LedgerPanel className="work-tier1 flex min-h-64 flex-col items-center justify-center text-center"><Target className="h-7 w-7 text-muted-foreground" aria-hidden="true" /><LedgerSectionLabel className="mt-3">No active Outcomes</LedgerSectionLabel></LedgerPanel>
  }

  const openSteps = committed.length
  const committedMinutes = committed.reduce((sum, item) => sum + item.action.plannedMinutes, 0)
  const planGoalId = activeSprint?.goals[0]?.goalId ?? goals.find((goal) => goal.status === 'active')?.id
  const rowProps = { busy, onStart: start, onResize: resize, onBacklog: moveToBacklog }
  return (
    <>
      <LedgerPanel className="work-tier1 p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><LedgerSectionLabel>Today&apos;s queue</LedgerSectionLabel><LedgerMeta className="mt-1">{activeSprint ? activeSprint.name : 'Planned Steps'}</LedgerMeta><LedgerMeta className="mt-1">{inSprint.length} committed · {openSteps} open Steps</LedgerMeta></div>
          <div className="text-right"><p className="ledger-metric text-2xl">{committedMinutes}m</p><LedgerMeta>planned</LedgerMeta></div>
        </div>
        <div className="mt-5">
          {compact.length === 0 ? <div className="work-empty-state flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium">{outsideSprint.length > 0 ? 'Nothing from the current Sprint is planned.' : 'Nothing committed for Today.'}</p>{planGoalId && <Button variant="outline" onClick={() => openGoal(planGoalId)}>Plan a Step</Button>}</div> : <div className="divide-y divide-border/70">{compact.map((item) => <StepRow key={item.action.id} item={item} {...rowProps} />)}</div>}
        </div>
        {outsideVisible.length > 0 && <details className="mt-5 border-t border-border/70 pt-4"><summary className="cursor-pointer text-xs font-medium text-muted-foreground">Outside current Sprint · {outsideVisible.length}</summary><div className="mt-3 divide-y divide-border/70">{outsideVisible.map((item) => <StepRow key={item.action.id} item={item} outsideSprint {...rowProps} />)}</div></details>}
        {hiddenCount > 0 && <LedgerMeta className="mt-4 border-t border-border/70 pt-4">{hiddenCount} more planned Step{hiddenCount === 1 ? '' : 's'}</LedgerMeta>}
      </LedgerPanel>
      <Dialog open={Boolean(resizeAction)} onOpenChange={(open) => { if (!open && !busy) setResizeAction(null) }}>
        <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Resize Step</DialogTitle><DialogDescription>Change the planned minutes without losing the Step.</DialogDescription></DialogHeader><FormField label="Planned minutes" required><Input type="number" min={1} max={720} value={resizeMinutes} onChange={(event) => setResizeMinutes(event.target.value)} /></FormField><DialogFooter><Button variant="ghost" onClick={() => setResizeAction(null)} disabled={Boolean(busy)}>Cancel</Button><Button onClick={saveResize} disabled={Boolean(busy)}>Save changes</Button></DialogFooter></DialogContent>
      </Dialog>
    </>
  )
}

function StepRow({ item: { goal, action }, busy, outsideSprint = false, onStart, onResize, onBacklog }: { item: StepItem; busy: string | null; outsideSprint?: boolean; onStart: (action: GoalAction) => void; onResize: (action: GoalAction) => void; onBacklog: (action: GoalAction) => void }) {
  const loggedMinutes = actionLoggedMinutes(action)
  return <div className="work-row flex items-center gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium leading-5">{action.title}</p><LedgerMeta className="mt-1 truncate">{goal.title} · {action.plannedMinutes}m{loggedMinutes > 0 ? ` · ${formatMinutes(loggedMinutes)} logged` : ''}{outsideSprint ? ' · Outside current Sprint' : ''}</LedgerMeta></div><Button size="sm" onClick={() => onStart(action)} disabled={busy === action.id}><Play className="h-3.5 w-3.5" /> Start</Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`More options for ${action.title}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onResize(action)}><RotateCcw /> Resize Step</DropdownMenuItem><DropdownMenuItem onSelect={() => onBacklog(action)}><Clock3 /> Move to backlog</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
}

export function RunningSession({ session, action, goalTitle, availableSteps = [] }: { session: WorkSession; action: GoalAction; goalTitle: string; availableSteps?: RecoveryStep[] }) {
  const [now, setNow] = useState(Date.now())
  const startedAt = new Date(session.startedAt).getTime()
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60))
  const [minutes, setMinutes] = useState(String(elapsedMinutes))
  const [minutesEdited, setMinutesEdited] = useState(false)
  const [output, setOutput] = useState('')
  const [friction, setFriction] = useState('')
  const [finishMode, setFinishMode] = useState<'stop' | 'interrupt' | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])

  async function finish(outcome: 'completed' | 'stopped' | 'interrupted' | 'abandoned') {
    setFinishing(true)
    try {
      const actualMinutes = minutesEdited ? Math.max(1, Number(minutes)) : Math.max(1, Math.ceil(elapsedSeconds / 60))
      const disposition = outcome === 'completed' ? 'complete_step' : outcome === 'stopped' ? 'stop_keep_today' : outcome === 'interrupted' ? 'interrupted_keep_today' : 'stop_to_backlog'
      await store.finishSession({ sessionId: session.id, actualMinutes, resultNote: output, friction, disposition }, outcome === 'interrupted' ? { refresh: false } : undefined)
      if (outcome === 'interrupted') {
        toast.success('Interruption recorded. Choose what makes the next start easier.')
        setRecoveryOpen(true)
      } else toast.success(outcome === 'completed' ? `Step completed · ${actualMinutes}m logged` : outcome === 'stopped' ? 'Session ended; Step kept in Today.' : 'Step moved to backlog.')
      setFinishMode(null)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not end Session') }
    finally { setFinishing(false) }
  }

  async function recover(choice: 'resume' | 'shorten' | 'switch' | 'keep' | 'backlog', minutes?: number, next?: RecoveryStep) {
    setRecoveryBusy(true)
    try {
      if (choice === 'resume') await store.startSession(action.id)
      if (choice === 'shorten' && minutes) {
        await store.updateGoalAction(action.id, { plannedMinutes: minutes, status: 'today' })
        await store.startSession(action.id)
      }
      if (choice === 'switch' && next) await store.startSession(next.action.id)
      if (choice === 'backlog') await store.updateGoalAction(action.id, { status: 'backlog' })
      if (choice === 'keep') await store.refreshWork()
      setRecoveryOpen(false)
      if (choice === 'resume') toast.success('Session resumed')
      else if (choice === 'shorten') toast.success(`Step reduced to ${minutes}m and resumed`)
      else if (choice === 'switch') toast.success(`Session started · ${next?.action.title ?? 'next Step'}`)
      else if (choice === 'backlog') toast.success('Step moved to backlog')
      else toast.success('Step kept in Today')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update the interrupted Step') }
    finally { setRecoveryBusy(false) }
  }

  return <>
    <LedgerPanel className="work-tier1 p-5 md:p-6">
      <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="flex items-center gap-2 text-xs font-medium text-[var(--growth)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--growth)]" /> Session running</p><h2 className="mt-3 text-xl font-semibold leading-7">{action.title}</h2><LedgerMeta className="mt-1">{goalTitle}</LedgerMeta></div><div className="text-right" aria-live="polite"><p className="ledger-metric text-4xl tabular-nums">{formatClock(elapsedSeconds)}</p><LedgerMeta>{sessionTimeLabel(elapsedSeconds, action.plannedMinutes)}</LedgerMeta></div></div>
      {action.definitionOfDone && <LedgerRow className="mt-5 border-border/70 bg-background/20 text-sm"><CheckCircle2 className="mr-2 inline h-4 w-4 text-[var(--growth)]" />{action.definitionOfDone}</LedgerRow>}
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted" aria-label="Session elapsed against planned time"><div className="h-full rounded-full bg-[var(--growth)] transition-[width] duration-500" style={{ width: `${Math.min(100, (elapsedSeconds / Math.max(1, action.plannedMinutes * 60)) * 100)}%` }} /></div>
      <div className="mt-5 grid gap-5 sm:grid-cols-[110px_1fr]"><FormField label="Actual minutes"><Input type="number" min={1} max={720} value={minutesEdited ? minutes : String(Math.max(1, Math.ceil(elapsedSeconds / 60)))} onChange={(event) => { setMinutesEdited(true); setMinutes(event.target.value) }} /></FormField><FormField label="Result note" hint="Optional: what changed, shipped, or became clear?"><Input value={output} onChange={(event) => setOutput(event.target.value)} placeholder="A short result" /></FormField></div>
      <div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => void finish('completed')} disabled={finishing}><CheckCircle2 className="h-4 w-4" /> Complete Step</Button><Button variant="outline" onClick={() => setFinishMode('stop')} disabled={finishing}><Pause className="h-4 w-4" /> End Session</Button><Button variant="ghost" onClick={() => setFinishMode('interrupt')} disabled={finishing}>I was interrupted</Button></div>
    </LedgerPanel>
    <Dialog open={finishMode !== null} onOpenChange={(open) => { if (!open && !finishing) setFinishMode(null) }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{finishMode === 'interrupt' ? 'Record the interruption' : 'End Session'}</DialogTitle><DialogDescription>{finishMode === 'interrupt' ? 'Write down the friction if useful. You will choose the next small move after saving.' : 'The Step is not complete yet. Where should it go next?'}</DialogDescription></DialogHeader>{finishMode === 'interrupt' && <FormField label="Friction or interruption" hint="Optional"><Textarea rows={3} value={friction} onChange={(event) => setFriction(event.target.value)} placeholder="What got in the way?" /></FormField>}<DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={() => setFinishMode(null)} disabled={finishing}>Keep working</Button>{finishMode === 'interrupt' ? <Button variant="outline" onClick={() => void finish('interrupted')} disabled={finishing}>Record and recover</Button> : <><Button variant="outline" onClick={() => void finish('stopped')} disabled={finishing}>Keep in Today</Button><Button onClick={() => void finish('abandoned')} disabled={finishing}>Move to backlog</Button></>}</DialogFooter></DialogContent></Dialog>
    <Dialog open={recoveryOpen} onOpenChange={(open) => { if (!open && !recoveryBusy) void recover('keep') }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>What makes the next start easier?</DialogTitle><DialogDescription>{action.title} is still available. Choose one deliberate next move; nothing is silently discarded.</DialogDescription></DialogHeader><div className="space-y-4"><div className="grid gap-2 sm:grid-cols-2"><Button onClick={() => void recover('resume')} disabled={recoveryBusy}>Resume this Step</Button><Button variant="outline" onClick={() => void recover('keep')} disabled={recoveryBusy}>Keep it in Today</Button><Button variant="outline" onClick={() => void recover('shorten', 5)} disabled={recoveryBusy}>Reduce to 5m and resume</Button><Button variant="outline" onClick={() => void recover('shorten', 10)} disabled={recoveryBusy}>Reduce to 10m and resume</Button><Button variant="outline" onClick={() => void recover('shorten', 15)} disabled={recoveryBusy}>Reduce to 15m and resume</Button></div>{availableSteps.length > 0 && <div className="border-t border-border/70 pt-4"><p className="text-sm font-medium">Switch to another Today Step</p><div className="mt-2 space-y-1">{availableSteps.slice(0, 3).map((step) => <Button key={step.action.id} variant="ghost" className="h-auto w-full justify-between px-2 py-2 text-left" onClick={() => void recover('switch', undefined, step)} disabled={recoveryBusy}><span className="min-w-0"><span className="block truncate text-sm">{step.action.title}</span><span className="block truncate text-xs text-muted-foreground">{step.goalTitle} · {step.action.plannedMinutes}m</span></span><Play className="ml-3 h-4 w-4 shrink-0" /></Button>)}</div></div>}<div className="border-t border-border/70 pt-4"><Button variant="ghost" onClick={() => void recover('backlog')} disabled={recoveryBusy}>Move this Step to backlog</Button></div></div></DialogContent></Dialog>
  </>
}

function formatClock(seconds: number) { const minutes = Math.floor(seconds / 60); const remainder = seconds % 60; return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` }
function sessionTimeLabel(elapsedSeconds: number, plannedMinutes: number) {
  const plannedSeconds = Math.max(1, plannedMinutes * 60)
  if (elapsedSeconds < plannedSeconds) return `${Math.ceil((plannedSeconds - elapsedSeconds) / 60)}m planned remaining`
  if (elapsedSeconds === plannedSeconds) return 'planned time reached'
  return `${Math.ceil((elapsedSeconds - plannedSeconds) / 60)}m over`
}
