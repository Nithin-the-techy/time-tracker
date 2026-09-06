'use client'

import { useMemo, useState } from 'react'
import { CalendarRange, Plus, Play, Pause, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGoals, useSprints, store } from '@/lib/hooks'
import { toKey } from '@/lib/dates'
import { toast } from 'sonner'

export function SprintPanel() {
  const { sprints, loading } = useSprints()
  const { goals } = useGoals()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phase, setPhase] = useState('')
  const [startDate, setStartDate] = useState(toKey(new Date()))
  const [endDate, setEndDate] = useState(toKey(new Date()))
  const [busy, setBusy] = useState(false)
  const [goalId, setGoalId] = useState('')
  const [editing, setEditing] = useState(false)
  const [attaching, setAttaching] = useState(false)
  const active = useMemo(() => sprints.find((s) => s.status === 'active'), [sprints])
  const visible = sprints.filter((s) => s.status !== 'archived').slice(0, 4)

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await store.createSprint({ name, phase: phase || null, startDate, endDate, status: active ? 'planned' : 'active' })
      setName(''); setPhase(''); setOpen(false)
      toast.success('Sprint created')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create Sprint') }
    finally { setBusy(false) }
  }

  async function setStatus(id: string, status: 'active' | 'paused') {
    try { await store.updateSprint(id, { status }); toast.success(status === 'active' ? 'Sprint activated' : 'Sprint paused') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update Sprint') }
  }

  async function attachGoal() {
    if (!active || !goalId || attaching) return
    setAttaching(true)
    try {
      await store.updateSprint(active.id, { goalIds: [...active.goals.map((link) => link.goalId), goalId] })
      setGoalId('')
      toast.success('Outcome added to Sprint')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add outcome') }
    finally { setAttaching(false) }
  }

  async function archiveActive() {
    if (!active || !window.confirm('Archive this Sprint? Its goals remain available.')) return
    await setStatus(active.id, 'paused')
    await store.updateSprint(active.id, { status: 'archived' })
  }

  const availableGoals = active ? goals.filter((goal) => goal.status === 'active' && !active.goals.some((link) => link.goalId === goal.id)) : []

  return (
    <Card className="border-[var(--growth)]/25">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2"><CalendarRange className="h-4 w-4 text-[var(--growth)]" /> {active ? 'Current Sprint' : 'Sprint'}</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen((value) => !value)}><Plus className="h-4 w-4 mr-1" /> New Sprint</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {active ? (
          <div className="rounded-md border border-[var(--growth)]/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="font-serif text-xl">{active.name}</p><p className="text-sm text-muted-foreground mt-1">{active.startDate} → {active.endDate}</p>{active.phase && <p className="text-sm text-muted-foreground mt-2">{active.phase}</p>}</div>
              <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEditing((value) => !value)}><Pencil className="h-3.5 w-3.5" /></Button><Button size="sm" variant="ghost" onClick={() => setStatus(active.id, 'paused')}><Pause className="h-3.5 w-3.5 mr-1" /> Pause</Button></div>
            </div>
            {editing && <div className="grid sm:grid-cols-2 gap-3 mt-4 rounded-md bg-background/50 p-3"><div><Label className="text-xs">Name</Label><Input defaultValue={active.name} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== active.name) store.updateSprint(active.id, { name }).catch((error) => toast.error(error.message)) }} /></div><div><Label className="text-xs">Focus</Label><Input defaultValue={active.phase ?? ''} placeholder="What this period is for" onBlur={(event) => { const phase = event.target.value.trim() || null; if (phase !== active.phase) store.updateSprint(active.id, { phase }).catch((error) => toast.error(error.message)) }} /></div><div><Label className="text-xs">Starts</Label><Input type="date" defaultValue={active.startDate} onBlur={(event) => store.updateSprint(active.id, { startDate: event.target.value }).catch((error) => toast.error(error.message))} /></div><div><Label className="text-xs">Ends</Label><Input type="date" defaultValue={active.endDate} onBlur={(event) => store.updateSprint(active.id, { endDate: event.target.value }).catch((error) => toast.error(error.message))} /></div><Button size="sm" variant="ghost" className="sm:col-span-2 justify-start text-muted-foreground" onClick={archiveActive}>Archive Sprint</Button></div>}
            <p className="text-xs text-muted-foreground mt-3">{active.goals.length} outcome{active.goals.length === 1 ? '' : 's'}</p>
            {availableGoals.length > 0 && <div className="flex gap-2 mt-3"><select value={goalId} onChange={(event) => setGoalId(event.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"><option value="">Attach existing outcome…</option>{availableGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select><Button size="sm" variant="outline" onClick={attachGoal} disabled={!goalId || attaching}>Attach</Button></div>}
          </div>
        ) : null}

        {open && <div className="border-t border-border pt-3 space-y-2">
          <div className="grid sm:grid-cols-2 gap-2"><div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Current execution period" /></div><div><Label className="text-xs">Focus (optional)</Label><Input value={phase} onChange={(e) => setPhase(e.target.value)} placeholder="What this period is for" /></div></div>
          <div className="grid sm:grid-cols-2 gap-2"><div><Label className="text-xs">Starts</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div><div><Label className="text-xs">Ends</Label><Input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div></div>
          <Button onClick={create} disabled={busy || !name.trim()}><Play className="h-4 w-4 mr-1" /> Create Sprint</Button>
        </div>}

        {visible.filter((s) => s.id !== active?.id).map((s) => <div key={s.id} className="flex items-center justify-between gap-3 text-sm border-t border-border pt-2"><span className="truncate">{s.name}<span className="text-xs text-muted-foreground ml-2">{s.status}</span></span>{s.status === 'planned' || s.status === 'paused' ? <Button size="sm" variant="outline" onClick={() => setStatus(s.id, 'active')}><Play className="h-3.5 w-3.5 mr-1" /> Activate</Button> : null}</div>)}
      </CardContent>
    </Card>
  )
}
