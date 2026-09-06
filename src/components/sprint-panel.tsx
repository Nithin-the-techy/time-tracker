'use client'

import { useMemo, useState } from 'react'
import { CalendarRange, Plus, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSprints, store } from '@/lib/hooks'
import { toKey } from '@/lib/dates'
import { toast } from 'sonner'

export function SprintPanel() {
  const { sprints, loading } = useSprints()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phase, setPhase] = useState('')
  const [startDate, setStartDate] = useState(toKey(new Date()))
  const [endDate, setEndDate] = useState(toKey(new Date()))
  const [busy, setBusy] = useState(false)
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

  return (
    <Card className="border-[var(--growth)]/25">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2"><CalendarRange className="h-4 w-4 text-[var(--growth)]" /> Sprint</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen((value) => !value)}><Plus className="h-4 w-4 mr-1" /> New</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {active ? (
          <div className="rounded-md border border-[var(--growth)]/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-serif text-xl">{active.name}</p><p className="text-xs text-muted-foreground">{active.phase || 'Active phase'} · {active.startDate} → {active.endDate}</p></div>
              <Button size="sm" variant="ghost" onClick={() => setStatus(active.id, 'paused')}><Pause className="h-3.5 w-3.5 mr-1" /> Pause</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">{active.goals.length} goal{active.goals.length === 1 ? '' : 's'} connected</p>
          </div>
        ) : !loading ? <p className="text-sm text-muted-foreground">No active Sprint.</p> : null}

        {open && <div className="border-t border-border pt-3 space-y-2">
          <div className="grid sm:grid-cols-2 gap-2"><div><Label className="text-[11px]">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Current execution phase" /></div><div><Label className="text-[11px]">Phase note (optional)</Label><Input value={phase} onChange={(e) => setPhase(e.target.value)} placeholder="What this phase is about" /></div></div>
          <div className="grid sm:grid-cols-2 gap-2"><div><Label className="text-[11px]">Starts</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div><div><Label className="text-[11px]">Ends</Label><Input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div></div>
          <Button onClick={create} disabled={busy || !name.trim()}><Play className="h-4 w-4 mr-1" /> Create Sprint</Button>
        </div>}

        {visible.filter((s) => s.id !== active?.id).map((s) => <div key={s.id} className="flex items-center justify-between gap-3 text-sm border-t border-border pt-2"><span className="truncate">{s.name}<span className="text-xs text-muted-foreground ml-2">{s.status}</span></span>{s.status === 'planned' || s.status === 'paused' ? <Button size="sm" variant="outline" onClick={() => setStatus(s.id, 'active')}><Play className="h-3.5 w-3.5 mr-1" /> Activate</Button> : null}</div>)}
      </CardContent>
    </Card>
  )
}
