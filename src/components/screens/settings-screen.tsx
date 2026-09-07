'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Plus, Trash2, Download, Upload, AlertTriangle, X, LogOut } from 'lucide-react'
import { useDepartments, useRivals, store } from '@/lib/hooks'
import { DEPARTMENT_COLORS } from '@/lib/constants'
import { NeutralBaselineManager } from '@/components/neutral-baseline-manager'
import { toast } from 'sonner'
import { DEPARTMENT_MODULES, type DepartmentModuleKey } from '@/lib/department-modules'
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
    <div className="space-y-6 pb-20 max-w-2xl">
      <div>
        <h1 className="ledger-page-title">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Shape the ledger without changing the records it contains.</p>
      </div>

      <DepartmentModulesCard departments={departments} />

      {/* Sleep & neutral baseline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sleep &amp; neutral baseline</CardTitle>
          <CardDescription>
            Neutral = sleep + everything else that isn&apos;t work or waste. Correct a specific day
            without inventing defaults; every total and chart follows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NeutralBaselineManager />
        </CardContent>
      </Card>

      {/* Sub-department weights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sub-department weights</CardTitle>
          <CardDescription>
            Multiplier per sub-department (0.1–5.0, default 1.0). Kept for reference and rival
            estimates — the hours and GPP figures elsewhere use plain logged time. Every change is
            recorded in the audit log.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-4">
              {departments.map((d) => (
                <div key={d.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DEPARTMENT_COLORS[d.slug] ?? '#888' }} />
                    <span className="font-serif text-sm">{d.name}</span>
                  </div>
                  <div className="space-y-1.5 pl-5">
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
          <CardDescription>
            Add or archive sub-departments. The 9 top-level departments stay fixed; everything under them is editable.
          </CardDescription>
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
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Rivals</CardTitle>
          <CardDescription>
            Peers to compare against. Estimate their weekly minutes per sub-department; standings
            rank everyone by monthly GPP (hours shown alongside) on equal footing.
          </CardDescription>
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
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Backup</CardTitle>
          <CardDescription>
            Export a JSON snapshot of all data. Import it on another device to restore. Data lives on the server; this is a manual backup.
          </CardDescription>
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

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-sm">Clear activity data</CardTitle>
          <CardDescription>Removes logs, goals, Sprints, sessions, reviews, and rivals. Departments and categories remain.</CardDescription>
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
          <CardDescription>Sign out.</CardDescription>
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

function DepartmentModulesCard({ departments }: { departments: ReturnType<typeof useDepartments>['departments'] }) {
  const [name, setName] = useState('')
  const [moduleKey, setModuleKey] = useState<DepartmentModuleKey>('generic')
  const [busy, setBusy] = useState(false)
  const moduleOptions = Object.values(DEPARTMENT_MODULES)

  async function add() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await store.addDepartment(name.trim(), moduleKey)
      setName('')
      toast.success('Department created')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create department')
    } finally { setBusy(false) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Department operating modules</CardTitle>
        <CardDescription>Departments remain customizable containers. A module adds domain-specific language and workflow without splitting the goal system.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {departments.map((department) => (
          <div key={department.id} className="grid grid-cols-[1fr_150px] gap-2 items-center">
            <span className="text-sm truncate">{department.name.replace('Department of ', '')}</span>
            <select
              value={department.moduleKey ?? 'generic'}
              onChange={(e) => store.updateDepartment(department.id, { moduleKey: e.target.value as DepartmentModuleKey }).catch((error) => toast.error(error.message))}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              {moduleOptions.map((module) => <option key={module.key} value={module.key}>{module.label}</option>)}
            </select>
          </div>
        ))}
        <div className="grid sm:grid-cols-[1fr_150px_auto] gap-2 pt-3 border-t border-border">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New department" />
          <select value={moduleKey} onChange={(e) => setModuleKey(e.target.value as DepartmentModuleKey)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">{moduleOptions.map((module) => <option key={module.key} value={module.key}>{module.label}</option>)}</select>
          <Button onClick={add} disabled={busy || !name.trim()}><Plus className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  )
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
