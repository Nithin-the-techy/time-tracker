'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Plus, Trash2, Download, Upload, AlertTriangle, X, LogOut } from 'lucide-react'
import { useDepartments, useRivals, useWorkspacePreference, store } from '@/lib/hooks'
import { DEPARTMENT_COLORS } from '@/lib/constants'
import { NeutralBaselineManager } from '@/components/neutral-baseline-manager'
import { toast } from 'sonner'
import { useUIStore } from '@/store/ui-store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function SettingsScreen() {
  const { departments } = useDepartments()
  const { rivals } = useRivals()
  const fileRef = useRef<HTMLInputElement>(null)
  const settingsSection = useUIStore((state) => state.settingsSection)
  const clearSettingsSection = useUIStore((state) => state.clearSettingsSection)

  useEffect(() => {
    if (!settingsSection) return
    const target = document.getElementById(`settings-${settingsSection}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    clearSettingsSection()
  }, [settingsSection, clearSettingsSection])

  function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const text = String(reader.result ?? '')
      const ok = await store.importJSON(text)
      if (ok) toast.success('Backup imported')
      else toast.error('Invalid backup file')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function clearActivityData() {
    if (!window.confirm('Clear all logs, goals, Sprints, sessions, reviews, and rivals? Your departments stay.')) return
    if (!window.confirm('A backup was exported. This cannot be undone from the app. Clear activity data now?')) return
    const response = await fetch('/api/workspace/clear', { method: 'POST' })
    if (!response.ok) { toast.error('Could not clear activity data'); return }
    window.location.reload()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7 pb-20">
      <div>
        <h1 className="ledger-page-title">Settings</h1>
      </div>

      <Card id="settings-time">
        <CardHeader>
          <CardTitle className="text-sm">Time and calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <TimezoneSettings />
        </CardContent>
      </Card>

      {/* Sleep & neutral baseline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sleep &amp; neutral baseline</CardTitle>
        </CardHeader>
        <CardContent>
          <NeutralBaselineManager />
        </CardContent>
      </Card>

      {/* Sub-department weights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sub-department weights</CardTitle>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-2">
              {departments.map((d) => (
                <div key={d.id}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DEPARTMENT_COLORS[d.slug] ?? '#888' }} />
                    <span className="font-serif text-sm">{d.name}</span>
                  </div>
                  <div className="space-y-1 pl-5">
                    {d.subdepartments.length === 0 && (
                      <p className="text-xs text-muted-foreground">No sub-departments. Add one in the Sub-departments card below.</p>
                    )}
                    {d.subdepartments.map((s) => (
                      <SubWeightRow
                        key={s.id}
                        subdepartmentId={s.id}
                        slug={d.slug}
                        name={s.name}
                        currentWeight={s.valueWeight ?? 1.0}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sub-departments management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sub-departments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {departments.map((d) => (
            <SubDeptRow
              key={d.id}
              slug={d.slug}
              name={d.name}
              subType={d.subType}
              subs={d.subdepartments}
              onAdd={(name) => store.addSubdepartment(d.id, name)}
              onArchive={(id) => store.archiveSubdepartment(id)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Rivals */}
      <Card id="settings-rivals">
        <CardHeader>
          <CardTitle className="text-sm">Rivals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rivals.length === 0 && (
            <p className="text-sm text-muted-foreground">No rivals yet. Add one below.</p>
          )}
          {rivals.map((r) => (
            <RivalEditor key={r.id} rival={r} departments={departments} />
          ))}
          <AddRivalForm />
        </CardContent>
      </Card>

      {/* Backup */}
      <Card id="settings-backup">
        <CardHeader>
          <CardTitle className="text-sm">Backup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={async () => {
              const json = await store.exportJSON()
              const blob = new Blob([json], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `operations-dashboard-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(url)
              toast.success('Backup exported')
            }}>
              <Download className="h-4 w-4 mr-1.5" /> Export
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1.5" /> Import
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importJSON} />
          </div>
        </CardContent>
      </Card>

      <Card id="settings-archived">
        <CardHeader>
          <CardTitle className="text-sm">Archived and deleted</CardTitle>
        </CardHeader>
        <CardContent>
          <ArchivedManager />
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-sm">Clear activity data</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={clearActivityData}>
            <Trash2 className="h-4 w-4 mr-1.5" /> Clear activity data
          </Button>
        </CardContent>
      </Card>

      {/* Account / Sign out */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => store.logout()}>
            <LogOut className="h-4 w-4 mr-1.5" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function TimezoneSettings() {
  const { preference } = useWorkspacePreference()
  const [timezone, setTimezone] = useState(preference.timezone)
  const [saving, setSaving] = useState(false)
  async function save() {
    setSaving(true)
    try { await store.updateWorkspaceTimeZone(timezone.trim()); toast.success('Workspace timezone updated') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update timezone') }
    finally { setSaving(false) }
  }
  return <div className="flex flex-wrap items-end gap-3">
    <div className="min-w-[260px] flex-1"><Label htmlFor="workspace-timezone" className="mb-2 block text-xs font-medium">IANA timezone</Label><Input id="workspace-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Asia/Kolkata" /></div>
    <Button variant="outline" onClick={() => void save()} disabled={saving || !timezone.trim() || timezone === preference.timezone}>{saving ? 'Saving…' : 'Save timezone'}</Button>
  </div>
}

type ArchivedData = {
  goals: Array<{ id: string; title: string; status: string; actions: Array<{ id: string; title: string }> }>
  actions: Array<{ id: string; title: string; goal: { title: string } }>
  entries: Array<{ id: string; entryTimestamp: string; durationMinutes: number; department: { name: string } }>
  problems: Array<{ id: string; statement: string; goal: { title: string } }>
}

function ArchivedManager() {
  const [data, setData] = useState<ArchivedData | null>(null)
  const [busy, setBusy] = useState(false)
  async function load() {
    const response = await fetch('/api/archive')
    if (response.ok) setData(await response.json() as ArchivedData)
  }
  useEffect(() => {
    let current = true
    fetch('/api/archive').then((response) => response.ok ? response.json() as Promise<ArchivedData> : null).then((value) => { if (current && value) setData(value) }).catch(() => undefined)
    return () => { current = false }
  }, [])
  async function act(entity: 'goal' | 'action' | 'entry' | 'problem', id: string, operation: 'restore' | 'permanent') {
    if (operation === 'permanent' && !window.confirm('Permanently delete this record? Related history may be affected. This cannot be undone.')) return
    setBusy(true)
    try {
      const response = await fetch('/api/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity, id, operation }) })
      if (!response.ok) throw new Error('Could not update archived record')
      await load()
      toast.success(operation === 'restore' ? 'Record restored' : 'Record permanently deleted')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update archived record') }
    finally { setBusy(false) }
  }
  if (!data) return <p className="text-sm text-muted-foreground">Loading archived records…</p>
  const total = data.goals.length + data.actions.length + data.entries.length + data.problems.length
  if (total === 0) return <p className="text-sm text-muted-foreground">Nothing is archived or deleted.</p>
  return <div className="space-y-5">
    {data.goals.map((goal) => <div key={`goal-${goal.id}`} className="flex items-start justify-between gap-3 border-b border-border/70 pb-3"><div className="min-w-0"><p className="text-sm font-medium truncate">Outcome · {goal.title}</p><p className="mt-1 text-xs text-muted-foreground">{goal.actions.length} related Steps · {goal.status}</p></div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => void act('goal', goal.id, 'restore')}>Restore</Button><Button size="sm" variant="ghost" disabled={busy} className="text-destructive" onClick={() => void act('goal', goal.id, 'permanent')}>Delete permanently</Button></div></div>)}
    {data.actions.map((action) => <div key={`action-${action.id}`} className="flex items-start justify-between gap-3 border-b border-border/70 pb-3"><div className="min-w-0"><p className="text-sm font-medium truncate">Step · {action.title}</p><p className="mt-1 text-xs text-muted-foreground truncate">{action.goal.title}</p></div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => void act('action', action.id, 'restore')}>Restore</Button><Button size="sm" variant="ghost" disabled={busy} className="text-destructive" onClick={() => void act('action', action.id, 'permanent')}>Delete permanently</Button></div></div>)}
    {data.entries.map((entry) => <div key={`entry-${entry.id}`} className="flex items-start justify-between gap-3 border-b border-border/70 pb-3"><div className="min-w-0"><p className="text-sm font-medium">Entry · {entry.department.name}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(entry.entryTimestamp).toLocaleString()} · {entry.durationMinutes}m</p></div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => void act('entry', entry.id, 'restore')}>Restore</Button><Button size="sm" variant="ghost" disabled={busy} className="text-destructive" onClick={() => void act('entry', entry.id, 'permanent')}>Delete permanently</Button></div></div>)}
    {data.problems.map((problem) => <div key={`problem-${problem.id}`} className="flex items-start justify-between gap-3 border-b border-border/70 pb-3"><div className="min-w-0"><p className="truncate text-sm font-medium">Blocker · {problem.statement}</p><p className="mt-1 truncate text-xs text-muted-foreground">{problem.goal.title}</p></div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => void act('problem', problem.id, 'restore')}>Restore</Button><Button size="sm" variant="ghost" disabled={busy} className="text-destructive" onClick={() => void act('problem', problem.id, 'permanent')}>Delete permanently</Button></div></div>)}
  </div>
}

function SubWeightRow({ subdepartmentId, slug, name, currentWeight }: {
  subdepartmentId: string
  slug: string
  name: string
  currentWeight: number
}) {
  const [weight, setWeight] = useState(currentWeight)
  const [saving, setSaving] = useState(false)
  const dirty = Math.abs(weight - currentWeight) > 0.001

  async function save() {
    setSaving(true)
    try {
      await store.updateWeight(subdepartmentId, weight)
      toast.success(`${name} weight updated`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <div className="col-span-6 text-xs truncate">{name}</div>
      <div className="col-span-4">
        <Input
          type="number"
          min={0.1}
          max={5}
          step={0.1}
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
          className="h-8 max-w-[100px] tabular-nums"
        />
      </div>
      <div className="col-span-2 text-right">
        <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={save} className="h-8">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
        </Button>
      </div>
    </div>
  )
}

function SubDeptRow({ slug, name: deptName, subType, subs, onAdd, onArchive }: {
  slug: string
  name: string
  subType: string
  subs: { id: string; name: string; valueWeight: number }[]
  onAdd: (name: string) => void | Promise<void>
  onArchive: (id: string) => void | Promise<void>
}) {
  const [newSubName, setNewSubName] = useState('')
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DEPARTMENT_COLORS[slug] ?? '#888' }} />
        <span className="font-serif text-sm">{deptName}</span>
        <span className="text-[11px] text-muted-foreground ml-auto">{subType}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 pl-5">
        {subs.length === 0 ? (
          <span className="text-xs text-muted-foreground">None yet.</span>
        ) : (
          subs.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-xs bg-muted/30">
              {s.name}
              <span className="text-muted-foreground/70">× {s.valueWeight.toFixed(1)}</span>
              <button type="button" onClick={() => onArchive(s.id)} className="text-muted-foreground hover:text-[var(--depreciation)] transition" aria-label={`Archive ${s.name}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>
      <form
        className="flex gap-2 pl-5"
        onSubmit={(e) => { e.preventDefault(); if (!newSubName.trim()) return; onAdd(newSubName.trim()); setNewSubName('') }}
      >
        <Input value={newSubName} onChange={(e) => setNewSubName(e.target.value)} className="h-9 max-w-[240px]" />
        <Button type="submit" size="sm" disabled={!newSubName.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}

function RivalEditor({ rival, departments }: { rival: any; departments: any[] }) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState(rival.name)
  const [regionLabel, setRegionLabel] = useState(rival.regionLabel)

  async function updateEstimate(subdepartmentId: string, minutes: number) {
    // Build the full estimates array from current state + this update
    const existing = rival.sectorEstimates.map((s: any) => ({ subdepartmentId: s.subdepartmentId, estimatedWeeklyMinutes: s.estimatedWeeklyMinutes }))
    const idx = existing.findIndex((s: any) => s.subdepartmentId === subdepartmentId)
    if (idx >= 0) {
      existing[idx] = { subdepartmentId, estimatedWeeklyMinutes: minutes }
    } else {
      existing.push({ subdepartmentId, estimatedWeeklyMinutes: minutes })
    }
    await store.updateRival(rival.id, { sectorEstimates: existing })
  }

  return (
    <div className="border border-border rounded-md">
      <div className="flex items-center gap-2 p-3">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex-1 text-left">
          <span className="font-serif text-sm">{rival.name}</span>
          {rival.regionLabel && <span className="text-xs text-muted-foreground ml-2">{rival.regionLabel}</span>}
        </button>
        <Button variant="ghost" size="sm" onClick={async () => {
          await store.deleteRival(rival.id)
          toast.success('Rival deleted')
        }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {expanded && (
        <div className="p-3 pt-0 space-y-2 border-t border-border">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Region label</Label>
              <Input value={regionLabel} onChange={(e) => setRegionLabel(e.target.value)} className="h-8" />
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await store.updateRival(rival.id, { name, regionLabel })
              toast.success('Rival updated')
            }}
          >
            Save name / region
          </Button>
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Per-sub-department weekly estimates (minutes)</p>
            {departments.flatMap((d) =>
              d.subdepartments.map((sub: any) => {
                const est = rival.sectorEstimates.find((s: any) => s.subdepartmentId === sub.id)
                const minutes = est?.estimatedWeeklyMinutes ?? 0
                return (
                  <div key={sub.id} className="grid grid-cols-12 gap-2 items-center py-1.5 border-b border-border">
                    <div className="col-span-7 flex items-center gap-2 min-w-0">
                      <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: DEPARTMENT_COLORS[d.slug] ?? '#888' }} />
                      <span className="text-xs truncate">{d.name.replace('Department of ', '')} · {sub.name}</span>
                    </div>
                    <div className="col-span-5">
                      <Input
                        type="number"
                        min={0}
                        value={minutes}
                        onChange={(e) => updateEstimate(sub.id, Number(e.target.value))}
                        className="h-8 tabular-nums"
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AddRivalForm() {
  const [name, setName] = useState('')
  const [regionLabel, setRegionLabel] = useState('')
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        store.addRival({ name: name.trim(), regionLabel: regionLabel.trim() })
        setName('')
        setRegionLabel('')
        toast.success('Rival added')
      }}
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
      <Input value={regionLabel} onChange={(e) => setRegionLabel(e.target.value)} className="flex-1" />
      <Button type="submit" size="sm" disabled={!name.trim()}>
        <Plus className="h-4 w-4 mr-1" /> Add rival
      </Button>
    </form>
  )
}
