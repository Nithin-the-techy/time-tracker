'use client'

import { useMemo, useState } from 'react'
import { CalendarRange, ChevronRight, Pause, Play, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGoals, useSprints, store } from '@/lib/hooks'
import { daysRemaining } from '@/lib/goal-metrics'
import { addDays, toKey } from '@/lib/dates'
import { toast } from 'sonner'

export function SprintPanel() {
  const { sprints, loading } = useSprints()
  const { goals } = useGoals()
  const active = useMemo(() => sprints.find((sprint) => sprint.status === 'active'), [sprints])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [phase, setPhase] = useState('')
  const [startDate, setStartDate] = useState(toKey(new Date()))
  const [endDate, setEndDate] = useState(toKey(addDays(new Date(), 17)))
  const [goalId, setGoalId] = useState('')
  const [moveTargetByGoal, setMoveTargetByGoal] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  function openEditor() {
    setCreating(!active)
    if (active) {
      setName(active.name); setPhase(active.phase ?? ''); setStartDate(active.startDate); setEndDate(active.endDate)
    } else {
      setName(''); setPhase(''); setStartDate(toKey(new Date())); setEndDate(toKey(addDays(new Date(), 17)))
    }
    setOpen(true)
  }

  async function save() {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      if (creating || !active) {
        await store.createSprint({ name: name.trim(), phase: phase.trim() || null, startDate, endDate, status: active ? 'planned' : 'active' })
        toast.success('Sprint created')
      } else {
        await store.updateSprint(active.id, { name: name.trim(), phase: phase.trim() || null, startDate, endDate })
        toast.success('Sprint updated')
      }
      setOpen(false)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save Sprint') }
    finally { setBusy(false) }
  }

  async function setStatus(id: string, status: 'active' | 'paused' | 'completed' | 'archived') {
    try {
      await store.updateSprint(id, { status })
      toast.success(status === 'active' ? 'Sprint activated' : status === 'paused' ? 'Sprint paused' : status === 'completed' ? 'Sprint finished' : 'Sprint archived')
      if (id === active?.id) setOpen(false)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update Sprint') }
  }

  async function attachGoal() {
    if (!active || !goalId || busy) return
    setBusy(true)
    try {
      await store.updateSprint(active.id, { goalIds: [...active.goals.map((link) => link.goalId), goalId] })
      setGoalId('')
      toast.success('Outcome added to Sprint')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add outcome') }
    finally { setBusy(false) }
  }

  async function detachGoal(goalIdToRemove: string) {
    if (!active || busy) return
    setBusy(true)
    try {
      await store.updateSprint(active.id, { goalIds: active.goals.filter((link) => link.goalId !== goalIdToRemove).map((link) => link.goalId) })
      toast.success('Outcome moved outside this Sprint')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not remove outcome') }
    finally { setBusy(false) }
  }

  async function moveGoal(goalIdToMove: string) {
    if (!active || busy) return
    const targetId = moveTargetByGoal[goalIdToMove]
    const target = sprints.find((sprint) => sprint.id === targetId)
    if (!target) return
    setBusy(true)
    try {
      await store.updateSprint(target.id, { goalIds: [...target.goals.map((link) => link.goalId), goalIdToMove] })
      await store.updateSprint(active.id, { goalIds: active.goals.filter((link) => link.goalId !== goalIdToMove).map((link) => link.goalId) })
      setMoveTargetByGoal((current) => ({ ...current, [goalIdToMove]: '' }))
      toast.success(`Outcome moved to ${target.name}`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not move outcome') }
    finally { setBusy(false) }
  }

  const availableGoals = active ? goals.filter((goal) => goal.status === 'active' && !active.goals.some((link) => link.goalId === goal.id)) : []
  const otherSprints = sprints.filter((sprint) => sprint.id !== active?.id && sprint.status !== 'archived').slice(0, 4)
  const movableSprints = sprints.filter((sprint) => sprint.id !== active?.id && sprint.status !== 'archived')

  if (loading) return <div className="h-11 animate-pulse rounded-md border border-border bg-muted/20" />
  return (
    <>
      <button type="button" onClick={openEditor} className="flex w-full items-center gap-3 rounded-md border border-border px-4 py-3 text-left transition hover:border-foreground/25">
        <CalendarRange className="h-4 w-4 text-[var(--growth)]" />
        {active ? <><span className="min-w-0 flex-1 truncate text-sm font-medium">{active.name}</span><span className="text-sm text-muted-foreground">{deadlineLabel(daysRemaining(active.endDate))} · {active.goals.length} outcome{active.goals.length === 1 ? '' : 's'}</span></> : <span className="flex-1 text-sm text-muted-foreground">Create a Sprint to define the current execution window</span>}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
      {otherSprints.length > 0 && <details className="mt-2 rounded-md border border-border/70 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Other Sprints · switch execution window</summary>
        <div className="mt-2 divide-y divide-border/70">
          {otherSprints.map((sprint) => <div key={sprint.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0"><p className="truncate">{sprint.name}</p><p className="text-xs text-muted-foreground">{sprintStatusLabel(sprint.status)} · {sprint.goals.length} outcome{sprint.goals.length === 1 ? '' : 's'}</p></div>
            {(['planned', 'paused'].includes(sprint.status)) && <Button size="sm" variant="ghost" onClick={() => setStatus(sprint.id, 'active')}><Play className="h-3.5 w-3.5" /> Activate</Button>}
          </div>)}
        </div>
      </details>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{creating ? 'New Sprint' : 'Sprint settings'}</DialogTitle><DialogDescription>{creating ? 'Define one focused execution window.' : 'Keep the active window and its outcomes aligned.'}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="September execution window" /></div>
            <div><Label>Focus <span className="font-normal text-muted-foreground">(optional)</span></Label><Input value={phase} onChange={(event) => setPhase(event.target.value)} placeholder="What this period is for" /></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Starts</Label><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div><div><Label>Ends</Label><Input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div></div>
            {!creating && active && availableGoals.length > 0 && <div><Label>Add an existing outcome</Label><div className="flex gap-2"><select value={goalId} onChange={(event) => setGoalId(event.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"><option value="">Choose outcome…</option>{availableGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select><Button variant="outline" onClick={attachGoal} disabled={!goalId || busy}>Add</Button></div></div>}
            {!creating && active && active.goals.length > 0 && <div className="border-t border-border pt-4"><div className="flex items-baseline justify-between gap-3"><Label>Attached outcomes</Label><span className="text-xs text-muted-foreground">{active.goals.length} linked</span></div><div className="mt-2 space-y-2">{active.goals.map((link) => <div key={link.goalId} className="rounded-md border border-border/70 p-3"><div className="flex items-start justify-between gap-3"><span className="min-w-0 text-sm font-medium">{link.goal.title}</span><Button size="icon" variant="ghost" aria-label={`Remove ${link.goal.title} from Sprint`} onClick={() => detachGoal(link.goalId)} disabled={busy}><X className="h-4 w-4" /></Button></div>{movableSprints.length > 0 && <div className="mt-2 flex gap-2"><select aria-label={`Move ${link.goal.title} to another Sprint`} value={moveTargetByGoal[link.goalId] ?? ''} onChange={(event) => setMoveTargetByGoal((current) => ({ ...current, [link.goalId]: event.target.value }))} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"><option value="">Move to another Sprint…</option>{movableSprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name} · {sprintStatusLabel(sprint.status)}</option>)}</select><Button size="sm" variant="outline" onClick={() => moveGoal(link.goalId)} disabled={!moveTargetByGoal[link.goalId] || busy}>Move</Button></div>}</div>)}</div><p className="mt-2 text-xs text-muted-foreground">An outcome can stay outside every Sprint, or be moved between windows here.</p></div>}
            {!creating && otherSprints.length > 0 && <div className="border-t border-border pt-4"><p className="mb-2 text-sm font-medium">Other Sprints</p>{otherSprints.map((sprint) => <div key={sprint.id} className="flex items-center justify-between py-2 text-sm"><span>{sprint.name}</span>{(['planned', 'paused'].includes(sprint.status)) ? <Button size="sm" variant="ghost" onClick={() => setStatus(sprint.id, 'active')}><Play className="h-3.5 w-3.5" /> Activate</Button> : <span className="text-xs text-muted-foreground">{sprintStatusLabel(sprint.status)}</span>}</div>)}</div>}
          </div>
          <DialogFooter className="sm:justify-between">
            {!creating && active ? <div className="flex flex-wrap gap-1"><Button variant="ghost" onClick={() => setStatus(active.id, 'paused')}><Pause className="h-4 w-4" /> Pause</Button><Button variant="outline" onClick={() => setStatus(active.id, 'completed')}><CheckIcon /> Finish Sprint</Button><Button variant="ghost" className="text-muted-foreground" onClick={() => { if (window.confirm('Archive this Sprint? Its outcomes stay available.')) setStatus(active.id, 'archived') }}>Archive</Button></div> : <span />}
            <div className="flex gap-2"><Button variant="outline" onClick={() => { setCreating(true); setName(''); setPhase(''); setStartDate(toKey(new Date())); setEndDate(toKey(addDays(new Date(), 17))) }}><Plus className="h-4 w-4" /> New Sprint</Button><Button onClick={save} disabled={busy || !name.trim()}>{creating ? 'Create Sprint' : 'Save changes'}</Button></div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CheckIcon() {
  return <span aria-hidden="true" className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--growth)]" />
}

function sprintStatusLabel(status: string) {
  return status === 'completed' ? 'Finished' : status === 'paused' ? 'Paused' : status === 'planned' ? 'Planned' : status === 'active' ? 'Active' : 'Archived'
}

function deadlineLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'ends today'
  return `${days}d left`
}
