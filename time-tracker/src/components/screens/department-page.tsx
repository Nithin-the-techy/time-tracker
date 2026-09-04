'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Plus, X, Save, Loader2 } from 'lucide-react'
import { useUIStore } from '@/store/ui-store'
import { useEntriesInRange, useDepartments, useAllowances, useNeutralEntries, store } from '@/lib/hooks'
import {
  subdepartmentShares,
  bucketSeries,
  allowanceMap,
  formatMinutes,
  formatHours,
  type EntryWithSub,
} from '@/lib/metrics'
import { DEPARTMENT_COLORS } from '@/lib/constants'
import {
  totalDays,
  bucketsForRange,
  toKey,
  startOfWeek,
  type Granularity,
} from '@/lib/dates'
import { HoursBarChart } from '@/components/charts/hours-bar-chart'
import { DateRangePicker } from '@/components/date-range-picker'
import { GranularityToggle } from '@/components/granularity-toggle'
import { BucketedLogList } from '@/components/bucketed-log-list'
import { toast } from 'sonner'

export function DepartmentPage({ slug }: { slug: string }) {
  const { departments } = useDepartments()
  const dept = departments.find((d) => d.slug === slug) ?? null

  const deptFrom = useUIStore((s) => s.deptFrom)
  const deptTo = useUIStore((s) => s.deptTo)
  const deptGranularity = useUIStore((s) => s.deptGranularity)
  const setDeptRange = useUIStore((s) => s.setDeptRange)
  const setDeptGranularity = useUIStore((s) => s.setDeptGranularity)
  const closeDeptPage = useUIStore((s) => s.closeDeptPage)

  const { entries: allEntries } = useEntriesInRange(deptFrom, deptTo)
  const deptEntries = dept ? allEntries.filter((e) => e.departmentId === dept.id) : []

  const { allowances } = useAllowances()
  const { neutralEntries } = useNeutralEntries()
  const allow = useMemo(() => allowanceMap(allowances), [allowances])

  const totalMinutes = deptEntries.reduce((a, e) => a + e.durationMinutes, 0)
  const daysActive = new Set(deptEntries.map((e) => e.entryTimestamp.slice(0, 10))).size
  const subShares = dept ? subdepartmentShares(deptEntries as unknown as EntryWithSub[], dept.id) : []

  const subdepartments = dept ? (departments.find((d) => d.id === dept.id)?.subdepartments ?? []) : []

  const chartData = bucketSeries(
    deptEntries as unknown as EntryWithSub[],
    bucketsForRange(new Date(deptFrom + 'T00:00:00'), new Date(deptTo + 'T23:59:59'), deptGranularity),
    allow,
    neutralEntries,
  )

  if (!dept) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-muted-foreground">Department not found.</p>
        <Button variant="outline" size="sm" onClick={closeDeptPage} className="mt-4">
          Back to Database
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={closeDeptPage} className="px-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: DEPARTMENT_COLORS[dept.slug] ?? '#888' }}
          />
          <h1 className="font-serif text-xl">{dept.name}</h1>
        </div>
      </div>

      {/* Weekly review card — only on Infrastructure and Strategic Operations dept */}
      {dept.slug === 'operations' && (
        <WeeklyReviewCard />
      )}

      <DateRangePicker
        fromKey={deptFrom}
        toKey={deptTo}
        onChange={(from, to) => setDeptRange(from, to)}
      />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-muted-foreground">Bucket by</span>
        <GranularityToggle value={deptGranularity} onChange={setDeptGranularity} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Logged</p>
            <p className="text-2xl font-serif mt-1 tabular-nums">{formatHours(totalMinutes)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatMinutes(totalMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Days active</p>
            <p className="text-2xl font-serif mt-1 tabular-nums">{daysActive}</p>
            <p className="text-xs text-muted-foreground mt-0.5">in range</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Sub-departments</p>
            <p className="text-2xl font-serif mt-1 tabular-nums">{subdepartments.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{subShares.length} active</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Hours by {deptGranularity === 'day' ? 'day' : deptGranularity === 'week' ? 'week' : deptGranularity === 'month' ? 'month' : 'year'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalMinutes === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No entries in this range. Log one below.
            </p>
          ) : (
            <HoursBarChart data={chartData} color={DEPARTMENT_COLORS[dept.slug] ?? '#38bdf8'} stacked={false} />
          )}
        </CardContent>
      </Card>

      {/* Logging goes through the universal + button (pre-selects this dept). */}

      {/* Sub-department breakdown + management */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sub-departments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {subShares.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries for this department in this range.</p>
          ) : (
            subShares.map((s) => (
              <div key={s.subdepartmentId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate">{s.subdepartmentName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatMinutes(s.minutes)} · {Math.round(s.shareOfDeptGpp)}% · {s.entryCount} {s.entryCount === 1 ? 'entry' : 'entries'}
                    {s.weight !== 1 && <span className="ml-1.5 text-[var(--growth)]">× {s.weight.toFixed(1)}</span>}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${Math.max(2, s.shareOfDeptGpp)}%`, backgroundColor: DEPARTMENT_COLORS[dept.slug] ?? '#888' }}
                  />
                </div>
              </div>
            ))
          )}
          <ManageSubs departmentId={dept.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Logs in range</CardTitle>
        </CardHeader>
        <CardContent>
          <BucketedLogList
            entries={deptEntries}
            fromKey={deptFrom}
            toKey={deptTo}
            granularity={deptGranularity}
            deptId={dept.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}

// Weekly review card — shown only on the Infrastructure and Strategic Operations dept page.
function WeeklyReviewCard() {
  const [anchor] = useState<Date>(new Date())
  const weekStart = startOfWeek(anchor)
  const wsKey = toKey(weekStart)
  const [whatMattered, setWhatMattered] = useState('')
  const [bottleneck, setBottleneck] = useState('')
  const [nextChange, setNextChange] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    store.getReview(wsKey).then((review) => {
      if (!alive) return
      setWhatMattered(review?.whatMattered ?? '')
      setBottleneck(review?.bottleneck ?? '')
      setNextChange(review?.nextChange ?? '')
      setLastSaved(review?.updatedAt ?? null)
      setLoaded(true)
    })
    return () => { alive = false }
  }, [wsKey])

  async function save() {
    setSaving(true)
    try {
      await store.saveReview({
        weekStartDate: wsKey,
        whatMattered,
        bottleneck,
        nextChange,
      })
      toast.success('Weekly review saved')
      setDirty(false)
      const r = await store.getReview(wsKey)
      setLastSaved(r?.updatedAt ?? null)
    } catch {
      toast.error('Failed to save review')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Weekly review · week of {wsKey}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!loaded ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <Prompt
              label="What mattered this week?"
              value={whatMattered}
              onChange={(v) => { setWhatMattered(v); setDirty(true) }}
            />
            <Prompt
              label="What was the bottleneck?"
              value={bottleneck}
              onChange={(v) => { setBottleneck(v); setDirty(true) }}
            />
            <Prompt
              label="What changes next week?"
              value={nextChange}
              onChange={(v) => { setNextChange(v); setDirty(true) }}
            />
            <div className="flex items-center gap-3 pt-1">
              <Button onClick={save} disabled={saving || !dirty} size="sm">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Save review
              </Button>
              {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
              {!dirty && lastSaved && (
                <span className="text-xs text-muted-foreground">
                  Last saved · {new Date(lastSaved).toLocaleDateString()}
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Prompt({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[80px] resize-y"
      />
    </div>
  )
}

function ManageSubs({ departmentId }: { departmentId: string }) {
  const [newName, setNewName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const { departments } = useDepartments()
  const subs = departments.find((d) => d.id === departmentId)?.subdepartments ?? []

  function add(name: string) {
    store.addSubdepartment(departmentId, name)
    toast.success('Sub-department added')
  }
  function archive(id: string) {
    store.archiveSubdepartment(id)
    toast.success('Archived')
  }

  return (
    <div className="pt-3 border-t border-border mt-3">
      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        className="text-xs text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1"
      >
        {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        {showForm ? 'Cancel' : 'Manage sub-departments'}
      </button>

      {showForm && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {subs.length === 0 ? (
              <span className="text-xs text-muted-foreground">None yet. Add one to start logging.</span>
            ) : (
              subs.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-xs bg-muted/30"
                >
                  {s.name}
                  <span className="text-muted-foreground/70">× {s.valueWeight.toFixed(1)}</span>
                  <button
                    type="button"
                    onClick={() => archive(s.id)}
                    className="text-muted-foreground hover:text-[var(--depreciation)] transition"
                    aria-label={`Archive ${s.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newName.trim()) return
              add(newName.trim())
              setNewName('')
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-9 flex-1"
            />
            <Button type="submit" size="sm" disabled={!newName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
