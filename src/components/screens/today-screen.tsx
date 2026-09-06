'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Clock3, Pause, Play, RotateCcw, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useGoals, store, type FocusSession, type GoalAction } from '@/lib/hooks'
import { useUIStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function TodayScreen() {
  const { goals, loading } = useGoals()
  const openGoal = useUIStore((s) => s.openGoal)
  const setTab = useUIStore((s) => s.setTab)
  const [busy, setBusy] = useState<string | null>(null)

  const activeGoals = useMemo(
    () => goals.filter((g) => g.status === 'active').sort((a, b) => a.priority - b.priority || a.targetDate.localeCompare(b.targetDate)),
    [goals],
  )
  const primary = activeGoals[0]
  const actions = goals
    .flatMap((goal) => goal.actions.map((action) => ({ goal, action })))
    .filter(({ action }) => action.status === 'today' || action.status === 'in_progress')
    .sort((a, b) => (a.action.todayOrder ?? 99) - (b.action.todayOrder ?? 99))
  const running = actions
    .flatMap(({ goal, action }) => action.sessions.map((session) => ({ goal, action, session })))
    .find(({ session }) => session.status === 'running')

  async function start(action: GoalAction) {
    setBusy(action.id)
    try {
      await store.startFocusSession(action.id)
      toast.success('Session started')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start session')
    } finally {
      setBusy(null)
    }
  }

  async function shrink(action: GoalAction) {
    setBusy(action.id)
    try {
      const value = window.prompt('How many minutes should this action take now?', String(Math.min(action.plannedMinutes, 25)))
      const minutes = Number(value)
      if (!Number.isFinite(minutes) || minutes < 1) return
      await store.updateGoalAction(action.id, { plannedMinutes: Math.min(720, Math.round(minutes)), status: 'today' })
      toast.success('Action scope adjusted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not enter rescue mode')
    } finally {
      setBusy(null)
    }
  }

  async function defer(action: GoalAction) {
    setBusy(action.id)
    try { await store.updateGoalAction(action.id, { status: 'backlog' }) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not defer step') }
    finally { setBusy(null) }
  }

  if (loading) return <p className="text-sm text-muted-foreground py-12 text-center">Loading the operation…</p>

  if (!primary) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <Target className="h-9 w-9 mx-auto text-[var(--growth)]" />
        <h1 className="font-serif text-3xl">No active work yet</h1>
        <p className="text-sm text-muted-foreground">Create a goal, then add one next action to start a session.</p>
        <Button onClick={() => setTab('goals')}>Create goal <ArrowRight className="h-4 w-4 ml-1" /></Button>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-baseline justify-between"><h2 className="font-serif text-2xl">Today</h2><span className="text-sm text-muted-foreground">{actions.reduce((sum, item) => sum + item.action.plannedMinutes, 0)}m planned</span></div>

      {running ? (
        <RunningSession session={running.session} action={running.action} goalTitle={running.goal.title} />
      ) : (
        <Card className="border-[var(--growth)]/25">
          <CardHeader className="pb-2"><CardTitle className="text-base">Next steps</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {actions.length === 0 ? (
              <div className="py-5 text-center">
                <p className="text-sm text-muted-foreground mb-3">Choose an action from a goal to put it here.</p>
                <Button variant="outline" onClick={() => openGoal(primary.id)}>Open goal</Button>
              </div>
            ) : actions.map(({ goal, action }, index) => (
              <div key={action.id} className="rounded-md border border-border p-3 flex items-start gap-3">
                <span className="font-serif text-xl text-muted-foreground w-5">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{action.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {goal.title} · {action.subdepartment?.name ?? goal.department.name.replace('Department of ', '')} · {action.plannedMinutes}m
                  </p>
                  {action.definitionOfDone && <p className="text-xs mt-2">Done means: {action.definitionOfDone}</p>}
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => start(action)} disabled={busy === action.id}>
                      <Play className="h-3.5 w-3.5 mr-1" /> Start
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => shrink(action)} disabled={busy === action.id}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Resize
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => defer(action)} disabled={busy === action.id}>Defer</Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

    </div>
  )
}

function RunningSession({ session, action, goalTitle }: { session: FocusSession; action: GoalAction; goalTitle: string }) {
  const [now, setNow] = useState(Date.now())
  const elapsed = Math.max(1, Math.round((now - new Date(session.startedAt).getTime()) / 60_000))
  const [minutes, setMinutes] = useState(() => String(Math.max(1, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60_000))))
  const [output, setOutput] = useState('')
  const [friction, setFriction] = useState('')
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000)
    return () => window.clearInterval(timer)
  }, [])

  async function finish(outcome: 'completed' | 'interrupted' | 'abandoned') {
    setFinishing(true)
    try {
      await store.finishFocusSession({ sessionId: session.id, actualMinutes: Math.max(1, Number(minutes)), output, friction, outcome })
      toast.success(outcome === 'completed' ? 'Evidence recorded. Target advanced.' : 'Interruption recorded. Recovery starts now.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not finish session')
    } finally {
      setFinishing(false)
    }
  }

  return (
    <Card className="border-[var(--growth)]/60 shadow-[0_0_35px_rgba(251,191,36,0.06)]">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--growth)] flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[var(--growth)] animate-pulse" /> Running</p>
            <h2 className="font-serif text-2xl mt-1">{action.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{goalTitle} · {action.context}</p>
          </div>
          <div className="text-right"><p className="font-serif text-4xl tabular-nums">{elapsed}m</p><p className="text-[11px] text-muted-foreground">{Math.max(0, action.plannedMinutes - elapsed)}m remaining · planned {action.plannedMinutes}m</p></div>
        </div>
        {action.definitionOfDone && <div className="rounded-md bg-[var(--growth)]/8 border border-[var(--growth)]/20 p-3 text-sm"><CheckCircle2 className="h-4 w-4 inline mr-2" />{action.definitionOfDone}</div>}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-[var(--growth)] transition-all" style={{ width: `${Math.min(100, (elapsed / Math.max(1, action.plannedMinutes)) * 100)}%` }} /></div>
        <div className="grid sm:grid-cols-[110px_1fr] gap-3">
          <div><Label className="text-[11px]">Actual minutes</Label><Input type="number" min={1} max={720} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
          <div><Label className="text-[11px]">Result (optional)</Label><Input value={output} onChange={(e) => setOutput(e.target.value)} placeholder="Optional note" /></div>
        </div>
        <div><Label className="text-[11px]">Friction or interruption (optional)</Label><Textarea value={friction} onChange={(e) => setFriction(e.target.value)} rows={2} /></div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => finish('completed')} disabled={finishing}><CheckCircle2 className="h-4 w-4 mr-1" /> Finish session</Button>
          <Button variant="outline" onClick={() => finish('interrupted')} disabled={finishing}><Pause className="h-4 w-4 mr-1" /> Interrupted · keep in Now</Button>
          <Button variant="ghost" onClick={() => finish('abandoned')} disabled={finishing}><Clock3 className="h-4 w-4 mr-1" /> Defer to backlog</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function deadlineLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'due today'
  return `${days}d remaining`
}
