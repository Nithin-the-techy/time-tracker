'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronRight, Pause, Play, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FormField, LedgerSectionLabel } from '@/components/quiet-ledger'
import { useSprints, store, type Sprint } from '@/lib/hooks'
import { daysRemaining } from '@/lib/goal-metrics'
import { addDays, toKey } from '@/lib/dates'
import { toast } from 'sonner'

export function SprintPanel() {
  const { sprints, loading } = useSprints()
  const active = useMemo(() => sprints.find((sprint) => sprint.status === 'active'), [sprints])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(toKey(new Date()))
  const [endDate, setEndDate] = useState(toKey(addDays(new Date(), 14)))
  const [busy, setBusy] = useState(false)

  const editing = sprints.find((sprint) => sprint.id === editingId) ?? null

  function openEditor(sprint?: Sprint | null, makeNew = false) {
    const target = makeNew ? null : sprint ?? active ?? null
    setCreating(makeNew || !target)
    setEditingId(target?.id ?? null)
    setName(target?.name ?? '')
    setStartDate(target?.startDate ?? toKey(new Date()))
    setEndDate(target?.endDate ?? toKey(addDays(new Date(), 14)))
    setOpen(true)
  }

  async function save() {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      if (creating || !editing) {
        await store.createSprint({ name: name.trim(), startDate, endDate, status: active ? 'planned' : 'active' })
        toast.success(active ? 'Sprint added to the plan' : 'Sprint created')
      } else {
        await store.updateSprint(editing.id, { name: name.trim(), startDate, endDate })
        toast.success('Sprint updated')
      }
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save Sprint')
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(id: string, status: 'active' | 'paused' | 'completed' | 'archived') {
    if (status === 'active' && active && active.id !== id && !window.confirm(`Activate this Sprint and pause “${active.name}”?`)) return
    try {
      await store.updateSprint(id, { status })
      toast.success(status === 'active' ? 'Sprint activated' : status === 'paused' ? 'Sprint put on hold' : status === 'completed' ? 'Sprint closed' : 'Sprint archived')
      if (id === editingId && status === 'archived') setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update Sprint')
    }
  }

  if (loading) return <div className="h-28 animate-pulse rounded-lg border border-border bg-muted/20" aria-label="Loading Sprints" />

  const otherSprints = sprints.filter((sprint) => sprint.id !== active?.id && sprint.status !== 'archived')
  return (
    <section className="space-y-3" aria-labelledby="sprints-heading">
      <div className="flex items-center justify-between gap-3">
        <LedgerSectionLabel id="sprints-heading">Current Sprint</LedgerSectionLabel>
        <Button variant="outline" size="sm" onClick={() => openEditor(null, true)}><Plus className="h-4 w-4" /> Add Sprint</Button>
      </div>

      {active ? (
        <button type="button" onClick={() => openEditor(active)} className="work-rail-strip group flex w-full items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block line-clamp-2 text-sm font-medium text-foreground" title={active.name}>{active.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{deadlineLabel(daysRemaining(active.endDate))} · {active.goals.length} outcome{active.goals.length === 1 ? '' : 's'}</span>
            <span className="mt-3 block" aria-label={`Sprint calendar elapsed: ${sprintElapsed(active).elapsedDays} of ${sprintElapsed(active).totalDays} days`}>
              <span className="mb-1 block text-[11px] text-muted-foreground">Calendar elapsed · {sprintElapsed(active).elapsedDays} of {sprintElapsed(active).totalDays} days</span>
              <span className="block h-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-muted-foreground/60" style={{ width: `${sprintElapsed(active).percent}%` }} /></span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      ) : (
        <button type="button" onClick={() => openEditor(null, true)} className="work-empty-rail flex w-full items-center justify-between gap-3 text-left">
          <span><span className="block text-sm font-medium">Create your first Sprint</span><span className="mt-1 block text-xs text-muted-foreground">A time window gives Today a useful scope.</span></span><Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </button>
      )}

      {otherSprints.length > 0 && <details className="border-t border-border/70 pt-3">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Other Sprints <span className="ml-1 tabular-nums">{otherSprints.length}</span></summary>
        <div className="mt-2 divide-y divide-border/70">
          {otherSprints.map((sprint) => <div key={sprint.id} className="flex items-center gap-3 py-3">
            <button type="button" onClick={() => openEditor(sprint)} className="min-w-0 flex-1 text-left"><span className="block line-clamp-2 text-sm font-medium" title={sprint.name}>{sprint.name}</span><span className="mt-1 block text-xs text-muted-foreground">{sprintStatusLabel(sprint.status)} · {sprint.goals.length} outcome{sprint.goals.length === 1 ? '' : 's'}</span></button>
            {(['planned', 'paused'].includes(sprint.status)) && <Button size="sm" variant="ghost" onClick={() => setStatus(sprint.id, 'active')}><Play className="h-3.5 w-3.5" /> Activate</Button>}
          </div>)}
        </div>
      </details>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(88dvh,680px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{creating ? 'Add a Sprint' : 'Edit Sprint'}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <FormField label="Name" required><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="September planning window" /></FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Starts" required><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></FormField>
              <FormField label="Ends" required><Input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></FormField>
            </div>
            {editing && <div className="border-t border-border/70 pt-5"><p className="text-xs font-medium text-foreground">Lifecycle</p><p className="mt-1 text-xs text-muted-foreground">{sprintStatusLabel(editing.status)} · {editing.goals.length} linked Outcome{editing.goals.length === 1 ? '' : 's'}</p></div>}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? <div className="flex flex-wrap gap-1">
              {editing.status === 'active' && <Button variant="ghost" onClick={() => setStatus(editing.id, 'paused')}><Pause className="h-4 w-4" /> Pause</Button>}
              {editing.status !== 'active' && !['completed', 'archived'].includes(editing.status) && <Button variant="ghost" onClick={() => setStatus(editing.id, 'active')}><Play className="h-4 w-4" /> Activate</Button>}
              {editing.status !== 'completed' && editing.status !== 'archived' && <Button variant="outline" onClick={() => setStatus(editing.id, 'completed')}><Check className="h-4 w-4" /> Close Sprint</Button>}
              {editing.status !== 'archived' && <Button variant="ghost" className="text-muted-foreground" onClick={() => { if (window.confirm('Archive this Sprint? Its Outcomes stay available.')) void setStatus(editing.id, 'archived') }}>Archive</Button>}
            </div> : <span />}
            <Button onClick={save} disabled={busy || !name.trim() || !startDate || !endDate}>{busy ? 'Saving…' : creating ? 'Create Sprint' : 'Save changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function sprintElapsed(sprint: Sprint) {
  const start = new Date(`${sprint.startDate}T00:00:00`).getTime()
  const end = new Date(`${sprint.endDate}T23:59:59`).getTime()
  const totalDays = Math.max(1, Math.round((end - start) / 86_400_000))
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.floor((Date.now() - start) / 86_400_000) + 1))
  return { percent: Math.round((elapsedDays / totalDays) * 100), elapsedDays, totalDays }
}

function deadlineLabel(days: number) { return days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'ends today' : `${days}d left` }
function sprintStatusLabel(status: string) { return status === 'completed' ? 'Finished' : status === 'paused' ? 'Paused' : status === 'planned' ? 'Planned' : 'Active' }
