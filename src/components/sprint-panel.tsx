'use client'

import { useMemo, useState } from 'react'
import { CalendarRange, Check, ChevronRight, Pause, Play, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LedgerMeta, LedgerSectionLabel } from '@/components/quiet-ledger'
import { useDepartments, useGoals, useSprints, store, type Sprint } from '@/lib/hooks'
import { daysRemaining } from '@/lib/goal-metrics'
import { addDays, toKey } from '@/lib/dates'
import { toast } from 'sonner'

export function SprintPanel() {
  const { sprints, loading } = useSprints()
  const { goals } = useGoals()
  const { departments } = useDepartments()
  const active = useMemo(() => sprints.find((sprint) => sprint.status === 'active'), [sprints])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phase, setPhase] = useState('')
  const [startDate, setStartDate] = useState(toKey(new Date()))
  const [endDate, setEndDate] = useState(toKey(addDays(new Date(), 17)))
  const [goalId, setGoalId] = useState('')
  const [moveTargetByGoal, setMoveTargetByGoal] = useState<Record<string, string>>({})
  const [newOutcomeTitle, setNewOutcomeTitle] = useState('')
  const [newOutcomeDefinition, setNewOutcomeDefinition] = useState('')
  const [newOutcomeDepartmentId, setNewOutcomeDepartmentId] = useState('')
  const [newOutcomeDate, setNewOutcomeDate] = useState(toKey(addDays(new Date(), 17)))
  const [busy, setBusy] = useState(false)

  const editing = sprints.find((sprint) => sprint.id === editingId) ?? null
  const editableSprint = editing ?? (creating ? null : active ?? null)

  function resetNewOutcome() {
    setNewOutcomeTitle(''); setNewOutcomeDefinition(''); setNewOutcomeDate(toKey(addDays(new Date(), 17))); setGoalId('')
  }

  function openEditor(sprint?: Sprint | null, makeNew = false) {
    const target = makeNew ? null : sprint ?? active ?? null
    setCreating(makeNew || !target)
    setEditingId(target?.id ?? null)
    if (target) {
      setName(target.name); setPhase(target.phase ?? ''); setStartDate(target.startDate); setEndDate(target.endDate)
    } else {
      setName(''); setPhase(''); setStartDate(toKey(new Date())); setEndDate(toKey(addDays(new Date(), 17)))
    }
    resetNewOutcome(); setOpen(true)
  }

  async function save() {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      if (creating || !editableSprint) {
        await store.createSprint({ name: name.trim(), phase: phase.trim() || null, startDate, endDate, status: active ? 'planned' : 'active' })
        toast.success(active ? 'Sprint added to the plan' : 'Sprint created')
      } else {
        await store.updateSprint(editableSprint.id, { name: name.trim(), phase: phase.trim() || null, startDate, endDate })
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
      if (id === editingId) setOpen(false)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update Sprint') }
  }

  async function attachGoal() {
    if (!editableSprint || !goalId || busy) return
    setBusy(true)
    try {
      await store.updateSprint(editableSprint.id, { goalIds: [...editableSprint.goals.map((link) => link.goalId), goalId] })
      setGoalId(''); toast.success('Outcome added to Sprint')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add outcome') }
    finally { setBusy(false) }
  }

  async function createOutcome() {
    const departmentId = newOutcomeDepartmentId || departments[0]?.id
    if (!editableSprint || !departmentId || !newOutcomeTitle.trim() || !newOutcomeDefinition.trim() || busy) return
    setBusy(true)
    try {
      await store.createGoal({ departmentId, title: newOutcomeTitle.trim(), outcome: newOutcomeDefinition.trim(), startDate: toKey(new Date()), targetDate: newOutcomeDate, sprintId: editableSprint.id })
      resetNewOutcome(); toast.success('Outcome added to this Sprint')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add outcome') }
    finally { setBusy(false) }
  }

  async function detachGoal(goalIdToRemove: string) {
    if (!editableSprint || busy) return
    setBusy(true)
    try {
      await store.updateSprint(editableSprint.id, { goalIds: editableSprint.goals.filter((link) => link.goalId !== goalIdToRemove).map((link) => link.goalId) })
      toast.success('Outcome moved outside this Sprint')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not remove outcome') }
    finally { setBusy(false) }
  }

  async function moveGoal(goalIdToMove: string) {
    if (!editableSprint || busy) return
    const targetId = moveTargetByGoal[goalIdToMove]
    const target = sprints.find((sprint) => sprint.id === targetId)
    if (!target) return
    setBusy(true)
    try {
      await store.updateSprint(target.id, { goalIds: [...target.goals.map((link) => link.goalId), goalIdToMove] })
      await store.updateSprint(editableSprint.id, { goalIds: editableSprint.goals.filter((link) => link.goalId !== goalIdToMove).map((link) => link.goalId) })
      setMoveTargetByGoal((current) => ({ ...current, [goalIdToMove]: '' })); toast.success(`Outcome moved to ${target.name}`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not move outcome') }
    finally { setBusy(false) }
  }

  const visibleOtherSprints = sprints.filter((sprint) => sprint.id !== active?.id && sprint.status !== 'archived')
  const movableSprints = sprints.filter((sprint) => sprint.id !== editableSprint?.id && sprint.status !== 'archived')
  const availableGoals = editableSprint ? goals.filter((goal) => !['completed', 'abandoned'].includes(goal.status) && !editableSprint.goals.some((link) => link.goalId === goal.id)) : []

  if (loading) return <div className="h-28 animate-pulse rounded-lg border border-border bg-muted/20" />
  return <section className="space-y-3" aria-labelledby="sprints-heading">
    <div className="flex items-end justify-between gap-4"><div><LedgerSectionLabel id="sprints-heading">Sprints</LedgerSectionLabel><LedgerMeta className="mt-1">One current window keeps today&apos;s queue focused. Other windows wait below.</LedgerMeta></div><Button variant="outline" size="sm" onClick={() => openEditor(null, true)}><Plus className="h-4 w-4" /> Add Sprint</Button></div>

    {active ? <button type="button" onClick={() => openEditor(active)} className="group flex w-full items-center gap-4 rounded-lg border border-[var(--growth)]/40 bg-[var(--growth)]/[0.05] p-5 text-left transition hover:border-[var(--growth)]/70 hover:-translate-y-px"><CalendarRange className="h-5 w-5 shrink-0 text-[var(--growth)]" /><span className="min-w-0 flex-1"><span className="block text-xs font-medium text-[var(--growth)]">Current Sprint</span><span className="mt-1 block truncate text-base font-semibold">{active.name}</span>{active.phase && <span className="mt-1 block truncate text-sm text-muted-foreground">{active.phase}</span>}</span><span className="text-right"><span className="block text-sm tabular-nums text-foreground">{deadlineLabel(daysRemaining(active.endDate))}</span><span className="mt-1 block text-xs text-muted-foreground">{active.goals.length} outcome{active.goals.length === 1 ? '' : 's'} · edit window</span></span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" /></button> : <button type="button" onClick={() => openEditor(null, true)} className="flex w-full items-center gap-4 rounded-lg border border-dashed border-border p-5 text-left transition hover:border-foreground/35"><CalendarRange className="h-5 w-5 text-[var(--growth)]" /><span><span className="block text-sm font-semibold">Create your first Sprint</span><span className="mt-1 block text-sm text-muted-foreground">Give the next execution window a name and end date.</span></span></button>}

    {visibleOtherSprints.length > 0 && <details className="rounded-md border border-border/70 px-3 py-2"><summary className="cursor-pointer text-xs font-medium text-muted-foreground">Other Sprints · switch or edit a window</summary><div className="mt-2 divide-y divide-border/70">{visibleOtherSprints.map((sprint) => <div key={sprint.id} className="flex items-center gap-3 py-3"><button type="button" onClick={() => openEditor(sprint)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{sprint.name}</span><span className="mt-1 block text-xs text-muted-foreground">{sprintStatusLabel(sprint.status)} · {sprint.goals.length} outcome{sprint.goals.length === 1 ? '' : 's'}</span></button>{(['planned', 'paused'].includes(sprint.status)) && <Button size="sm" variant="ghost" onClick={() => setStatus(sprint.id, 'active')}><Play className="h-3.5 w-3.5" /> Activate</Button>}</div>)}</div></details>}

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[min(88dvh,780px)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{creating ? 'Add a Sprint' : `Edit ${editableSprint?.name ?? 'Sprint'}`}</DialogTitle><DialogDescription>{creating ? (active ? 'This Sprint will wait in the plan until you activate it.' : 'This becomes the current execution window.') : 'Keep the time window and its outcomes aligned.'}</DialogDescription></DialogHeader><div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><Label>Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="September execution window" /></div><div className="sm:col-span-2"><Label>Focus <span className="font-normal text-muted-foreground">(optional)</span></Label><Input value={phase} onChange={(event) => setPhase(event.target.value)} placeholder="What this period is for" /></div><div><Label>Starts</Label><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div><div><Label>Ends</Label><Input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div></div>
      {editableSprint && <><div className="border-t border-border pt-5"><div className="flex items-baseline justify-between gap-3"><div><Label>Outcomes in this Sprint</Label><p className="mt-1 text-xs text-muted-foreground">Attach, move, or remove outcomes without losing their steps.</p></div><span className="text-xs tabular-nums text-muted-foreground">{editableSprint.goals.length} linked</span></div>{editableSprint.goals.length > 0 && <div className="mt-3 space-y-2">{editableSprint.goals.map((link) => <div key={link.goalId} className="rounded-md border border-border/70 p-3"><div className="flex items-start justify-between gap-3"><span className="min-w-0 text-sm font-medium">{link.goal.title}</span><Button size="icon" variant="ghost" aria-label={`Remove ${link.goal.title} from Sprint`} onClick={() => detachGoal(link.goalId)} disabled={busy}><X className="h-4 w-4" /></Button></div>{movableSprints.length > 0 && <div className="mt-2 flex gap-2"><select aria-label={`Move ${link.goal.title} to another Sprint`} value={moveTargetByGoal[link.goalId] ?? ''} onChange={(event) => setMoveTargetByGoal((current) => ({ ...current, [link.goalId]: event.target.value }))} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"><option value="">Move to another Sprint…</option>{movableSprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name} · {sprintStatusLabel(sprint.status)}</option>)}</select><Button size="sm" variant="outline" onClick={() => moveGoal(link.goalId)} disabled={!moveTargetByGoal[link.goalId] || busy}>Move</Button></div>}</div>)}</div>}{availableGoals.length > 0 && <div className="mt-3 flex gap-2"><select value={goalId} onChange={(event) => setGoalId(event.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"><option value="">Attach an existing outcome…</option>{availableGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select><Button variant="outline" onClick={attachGoal} disabled={!goalId || busy}>Attach</Button></div>}</div><details className="rounded-md border border-border/70 p-3"><summary className="cursor-pointer text-sm font-medium">Add a new outcome to this Sprint</summary>{creating ? <p className="mt-3 text-xs text-muted-foreground">Save the Sprint first, then add its first outcome here.</p> : <div className="mt-3 space-y-3"><div className="grid gap-3 sm:grid-cols-2"><div><Label>Area</Label><select value={newOutcomeDepartmentId || departments[0]?.id || ''} onChange={(event) => setNewOutcomeDepartmentId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{departments.map((department) => <option key={department.id} value={department.id}>{department.name.replace('Department of ', '')}</option>)}</select></div><div><Label>Due</Label><Input type="date" value={newOutcomeDate} onChange={(event) => setNewOutcomeDate(event.target.value)} /></div></div><div><Label>Outcome</Label><Input value={newOutcomeTitle} onChange={(event) => setNewOutcomeTitle(event.target.value)} placeholder="A result this Sprint should move" /></div><div><Label>Finished when</Label><Textarea value={newOutcomeDefinition} onChange={(event) => setNewOutcomeDefinition(event.target.value)} rows={2} placeholder="What result would make this complete?" /></div><Button onClick={createOutcome} disabled={busy || !newOutcomeTitle.trim() || !newOutcomeDefinition.trim()}><Plus className="h-4 w-4" /> Add to Sprint</Button></div>}</details></>}
    </div><DialogFooter className="sm:justify-between">{!creating && editableSprint ? <div className="flex flex-wrap gap-1"><Button variant="ghost" onClick={() => setStatus(editableSprint.id, 'paused')}><Pause className="h-4 w-4" /> Pause</Button><Button variant="outline" onClick={() => setStatus(editableSprint.id, 'completed')}><Check className="h-4 w-4" /> Finish Sprint</Button><Button variant="ghost" className="text-muted-foreground" onClick={() => { if (window.confirm('Archive this Sprint? Its outcomes stay available.')) setStatus(editableSprint.id, 'archived') }}>Archive</Button></div> : <span />}</DialogFooter></DialogContent></Dialog>
  </section>
}

function deadlineLabel(days: number) { return days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'ends today' : `${days}d left` }
function sprintStatusLabel(status: string) { return status === 'completed' ? 'Finished' : status === 'paused' ? 'Paused' : status === 'planned' ? 'Planned' : 'Active' }
