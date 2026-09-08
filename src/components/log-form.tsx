'use client'

// Universal log — one form for every kind of time:
//   Productive → a department + sub-department entry (the classic log)
//   Neutral    → sleep, meals, hygiene, chores... (replaces that day's
//                assumed baseline with what actually happened)
//   Negative   → gaming, scrolling... (labels part of the derived
//                unproductive remainder — nothing else changes)
// Inside a department page the form opens pre-selected on that department.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus, CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDepartments, useGoals, store } from '@/lib/hooks'
import type { GoalAction } from '@/lib/store'
import { toKey } from '@/lib/dates'
import { NEUTRAL_ACTIVITIES, NEGATIVE_ACTIVITIES } from '@/lib/constants'
import { toast } from 'sonner'

type LogKind = 'productive' | 'neutral' | 'negative'

const DURATION_PRESETS: Record<LogKind, number[]> = {
  productive: [15, 30, 60, 90],
  neutral: [30, 60, 90, 120],
  negative: [15, 30, 60, 90],
}
const SLEEP_PRESETS = [60, 120, 300, 480]

const KIND_META: { id: LogKind; label: string; hint: string }[] = [
  { id: 'productive', label: 'Productive', hint: 'department work' },
  { id: 'neutral', label: 'Neutral', hint: 'sleep, meals, chores' },
  { id: 'negative', label: 'Negative', hint: 'time actively wasted' },
]

interface LogFormProps {
  presetDepartmentId?: string
  onSaved?: () => void
}

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function LogForm({ presetDepartmentId, onSaved }: LogFormProps) {
  const { departments } = useDepartments()
  const { goals } = useGoals()

  const [kind, setKind] = useState<LogKind>('productive')
  const [actionId, setActionId] = useState('')

  const presetDept = presetDepartmentId
    ? departments.find((d) => d.id === presetDepartmentId) ?? null
    : null
  const [deptId, setDeptId] = useState<string | null>(presetDept?.id ?? null)

  const selectedDept = departments.find((d) => d.id === deptId) ?? null
  const workSteps = goals.flatMap((goal) => goal.actions.filter((action) => !['completed', 'cancelled', 'archived'].includes(action.status)).map((action) => ({ action, goalTitle: goal.title, departmentId: goal.departmentId })))
  const selectedStep = workSteps.find((item) => item.action.id === actionId) ?? null
  const subs = selectedDept?.subdepartments ?? []

  const [subId, setSubId] = useState<string | null>(subs[0]?.id ?? null)
  const [showNewSub, setShowNewSub] = useState<boolean>(subs.length === 0 && !!deptId)
  const [newSubName, setNewSubName] = useState('')
  const [prevDeptId, setPrevDeptId] = useState<string | null>(deptId)

  // Reset sub state when dept changes.
  if (prevDeptId !== deptId) {
    setPrevDeptId(deptId)
    const next = departments.find((d) => d.id === deptId)
    setSubId(next && next.subdepartments.length > 0 ? next.subdepartments[0].id : null)
    setShowNewSub(!!next && next.subdepartments.length === 0)
    setNewSubName('')
  }

  // Neutral / negative activity selection (chips + free-form "other").
  const [neutralActivity, setNeutralActivity] = useState<string>('meals')
  const [negativeActivity, setNegativeActivity] = useState<string>('gaming')
  const [showCustomActivity, setShowCustomActivity] = useState(false)
  const [customActivity, setCustomActivity] = useState('')

  const [presetMinutes, setPresetMinutes] = useState<number>(30)
  const [customMinutes, setCustomMinutes] = useState<string>('')
  const [date, setDate] = useState<Date>(new Date())
  const [time, setTime] = useState<string>(nowHHMM())
  const [note, setNote] = useState('')
  const [obsidianRef, setObsidianRef] = useState('')
  const [saving, setSaving] = useState(false)

  const effectiveMinutes = customMinutes ? Math.max(1, Math.round(Number(customMinutes))) : presetMinutes
  const mins = effectiveMinutes
  const hasMins = mins > 0

  const activeActivity = kind === 'neutral' ? neutralActivity : negativeActivity
  const customName = customActivity.trim()
  const effectiveActivity = showCustomActivity && customName ? customName.toLowerCase() : activeActivity
  const activityLabel = showCustomActivity && customName ? customName : (
    kind === 'neutral'
      ? NEUTRAL_ACTIVITIES.find((a) => a.id === activeActivity)?.label ?? activeActivity
      : NEGATIVE_ACTIVITIES.find((a) => a.id === activeActivity)?.label ?? activeActivity
  )

  const presets = kind === 'neutral' && neutralActivity === 'sleep' && !showCustomActivity
    ? SLEEP_PRESETS
    : DURATION_PRESETS[kind]

  const needsTarget = kind === 'productive'
  const canSave =
    hasMins &&
    (kind === 'productive' ? (!!actionId || ((!!subId || (showNewSub && newSubName.trim().length > 0)) && !!deptId)) : true)

  function switchKind(k: LogKind) {
    setKind(k)
    setPresetMinutes(30)
    setCustomMinutes('')
    setShowCustomActivity(false)
    setCustomActivity('')
    if (k !== 'productive') setActionId('')
  }

  async function save() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const dateKey = toKey(date)

      if (kind === 'productive') {
        if (!deptId) return

        if (actionId) {
          const ts = `${dateKey}T${time || '00:00'}:00`
          await store.addManualSession({ actionId, actualMinutes: mins, entryTimestamp: ts, resultNote: note.trim() || null })
          toast.success(`Logged ${mins}m to ${selectedStep?.action.title ?? 'Step'}`)
          setCustomMinutes('')
          setNote('')
          setTime(nowHHMM())
          setDate(new Date())
          onSaved?.()
          return
        }

        let effectiveSubId = subId
        if (showNewSub && newSubName.trim() && !subId) {
          await store.addSubdepartment(deptId, newSubName.trim())
          const updated = store.getCache().departments?.find((d) => d.id === deptId)
          const newSub = updated?.subdepartments?.find(
            (s) => s.name.toLowerCase() === newSubName.trim().toLowerCase()
          )
          if (newSub) effectiveSubId = newSub.id
        }

        if (!effectiveSubId) {
          toast.error('Pick or create a sub-department')
          setSaving(false)
          return
        }

        const ts = `${dateKey}T${time || '00:00'}:00`
        await store.addEntry({
          departmentId: deptId,
          subdepartmentId: effectiveSubId,
          entryTimestamp: ts,
          durationMinutes: mins,
          note: note.trim() || null,
          obsidianRef: obsidianRef.trim() || null,
        })
        toast.success(`Logged ${mins}m to ${selectedDept?.name?.replace('Department of ', '') ?? 'department'}`)
      } else if (kind === 'neutral') {
        await store.addNeutralEntry({
          date: dateKey,
          activity: effectiveActivity,
          minutes: mins,
          note: note.trim() || null,
        })
        toast.success(`Logged ${mins}m neutral · ${activityLabel}`)
      } else {
        await store.addUnproductiveBlock({
          date: dateKey,
          tag: effectiveActivity,
          minutes: mins,
          note: note.trim() || null,
        })
        toast.success(`Logged ${mins}m negative · ${activityLabel}`)
      }

      setCustomMinutes('')
      setNote('')
      setObsidianRef('')
      setCustomActivity('')
      setShowCustomActivity(false)
      setTime(nowHHMM())
      setDate(new Date())
      if (showNewSub) {
        setNewSubName('')
        setShowNewSub(false)
      }

      onSaved?.()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Kind — the same form logs all three kinds of time */}
      <div className="grid grid-cols-3 gap-2">
        {KIND_META.map((k) => {
          const selected = kind === k.id
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => switchKind(k.id)}
              className={cn(
                'px-2 py-2 rounded-md border text-xs transition text-left',
                selected
                  ? k.id === 'productive'
                    ? 'border-[var(--growth)]/60 bg-[var(--growth)]/10 text-foreground'
                    : k.id === 'negative'
                      ? 'border-[var(--depreciation)]/60 bg-[var(--depreciation)]/10 text-foreground'
                      : 'border-foreground/50 bg-muted/50 text-foreground'
                  : 'border-border hover:border-foreground/40 hover:bg-muted/40',
              )}
            >
              <div className="flex items-center gap-1.5 font-medium">
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      k.id === 'productive'
                        ? 'var(--growth)'
                        : k.id === 'negative'
                          ? 'var(--depreciation)'
                          : 'var(--neutral-layer)',
                  }}
                />
                {k.label}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{k.hint}</div>
            </button>
          )
        })}
      </div>

      {kind === 'productive' && (
        <>
          <div>
            <Label className="text-[11px] mb-2 block text-muted-foreground">Step</Label>
            <select value={actionId} onChange={(event) => { const next = workSteps.find((item) => item.action.id === event.target.value); setActionId(event.target.value); if (next) { setDeptId(next.departmentId); setSubId(next.action.subdepartmentId); setShowNewSub(false) } }} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm">
              <option value="">General time</option>
              {workSteps.map(({ action, goalTitle }) => <option key={action.id} value={action.id}>{goalTitle} · {action.title}</option>)}
            </select>
          </div>
          {/* Department chips (hidden when presetDepartmentId is given) */}
          {!presetDepartmentId && !actionId && (
            <div>
              <Label className="text-[11px] mb-2 block text-muted-foreground">Department</Label>
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
                {departments.map((d) => {
                  const selected = d.id === deptId
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDeptId(d.id)}
                      className={cn(
                        'px-2 py-2 rounded-md border text-xs transition text-left',
                        selected
                          ? 'border-[var(--growth)]/60 bg-[var(--growth)]/10 text-foreground'
                          : 'border-border hover:border-foreground/40 hover:bg-muted/40',
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full shrink-0 bg-[var(--growth)]" />
                        <span className="truncate">{d.name.replace('Department of ', '')}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sub-department chips (with "+ new" always available) */}
          {selectedDept && !actionId && (
            <div>
              <Label className="text-[11px] mb-2 block text-muted-foreground">Sub-department</Label>
              {subs.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {selectedDept.name} has no sub-departments yet. Add one to start logging.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      onKeyDown={(ev) => { if (ev.key === 'Enter' && canSave) save() }}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (newSubName.trim()) {
                          store.addSubdepartment(selectedDept.id, newSubName.trim()).then(() => {
                            setNewSubName('')
                            setShowNewSub(false)
                          })
                        }
                      }}
                      disabled={!newSubName.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {subs.map((s) => {
                    const selected = s.id === subId && !showNewSub
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSubId(s.id)
                          setShowNewSub(false)
                          setNewSubName('')
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-md border text-sm transition',
                          selected
                            ? 'border-foreground/60 bg-foreground/10 text-foreground'
                            : 'border-border hover:border-foreground/40 hover:bg-muted/40',
                        )}
                      >
                        {s.name}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewSub(true)
                      setSubId(null)
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-md border text-sm transition inline-flex items-center gap-1',
                      showNewSub
                        ? 'border-foreground/60 bg-foreground/10 text-foreground'
                        : 'border-dashed border-foreground/40 hover:bg-muted/40',
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" /> new
                  </button>
                </div>
              )}
              {showNewSub && subs.length > 0 && (
                <div className="mt-2 flex gap-2">
                  <Input
                    autoFocus
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    onKeyDown={(ev) => { if (ev.key === 'Enter' && canSave) save() }}
                    className="flex-1"
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {kind !== 'productive' && (
        <div>
          <Label className="text-[11px] mb-2 block text-muted-foreground">
            {kind === 'neutral' ? 'What did you do?' : 'What was it?'}
          </Label>
          <div className="flex flex-wrap gap-2">
            {(kind === 'neutral' ? NEUTRAL_ACTIVITIES : NEGATIVE_ACTIVITIES).map((a) => {
              const selected = !showCustomActivity && activeActivity === a.id
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    if (kind === 'neutral') setNeutralActivity(a.id)
                    else setNegativeActivity(a.id)
                    setShowCustomActivity(false)
                    setCustomActivity('')
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-md border text-sm transition',
                    selected
                      ? kind === 'negative'
                        ? 'border-[var(--depreciation)]/60 bg-[var(--depreciation)]/10 text-foreground'
                        : 'border-foreground/60 bg-foreground/10 text-foreground'
                      : 'border-border hover:border-foreground/40 hover:bg-muted/40',
                  )}
                >
                  {a.label}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => {
                setShowCustomActivity(true)
                setCustomActivity('')
              }}
              className={cn(
                'px-3 py-1.5 rounded-md border text-sm transition inline-flex items-center gap-1',
                showCustomActivity
                  ? 'border-foreground/60 bg-foreground/10 text-foreground'
                  : 'border-dashed border-foreground/40 hover:bg-muted/40',
              )}
            >
              <Plus className="h-3.5 w-3.5" /> other
            </button>
          </div>
          {showCustomActivity && (
            <Input
              autoFocus
              placeholder="Activity name"
              value={customActivity}
              onChange={(e) => setCustomActivity(e.target.value)}
              onKeyDown={(ev) => { if (ev.key === 'Enter' && canSave) save() }}
              className="mt-2 max-w-[240px]"
            />
          )}
        </div>
      )}

      {/* Duration: presets + custom */}
      <div>
        <Label className="text-[11px] mb-2 block text-muted-foreground">Minutes</Label>
        <div className="grid grid-cols-4 gap-2 mb-2">
          {presets.map((m) => {
            const selected = !customMinutes && presetMinutes === m
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setPresetMinutes(m)
                  setCustomMinutes('')
                }}
                className={cn(
                  'py-2 rounded-md border text-sm transition font-medium',
                  selected
                    ? 'border-foreground/60 bg-foreground/10 text-foreground'
                    : 'border-border hover:border-foreground/40 hover:bg-muted/40',
                )}
              >
                {m >= 60 && m % 60 === 0 ? `${m / 60}h` : `${m}m`}
              </button>
            )
          })}
        </div>
        <Input
          type="number"
          min={1}
          value={customMinutes}
          onChange={(e) => setCustomMinutes(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && canSave) save() }}
          className="h-9 max-w-[180px]"
        />
        {customMinutes && (
          <p className="text-xs text-muted-foreground mt-1">
            Custom: {Math.round(Number(customMinutes))}m ({(Number(customMinutes) / 60).toFixed(1)}h)
          </p>
        )}
      </div>

      {/* Date + Time */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] mb-2 block text-muted-foreground">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal">
                <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                <span className={cn(toKey(date) === toKey(new Date()) ? 'text-muted-foreground' : '')}>
                  {toKey(date) === toKey(new Date()) ? 'Today' : toKey(date)}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                disabled={(d) => d > new Date() || d < new Date(new Date().setFullYear(new Date().getFullYear() - 1))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label className="text-[11px] mb-2 block text-muted-foreground">Time</Label>
          <div className="flex gap-1">
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              step={60}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTime(nowHHMM())}
              className="px-2"
              aria-label="Now"
              title="Now"
            >
              now
            </Button>
          </div>
        </div>
      </div>

      {/* Note + (productive only) Obsidian ref */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] mb-2 block text-muted-foreground">Note</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSave) save() }}
          />
        </div>
        {kind === 'productive' && (
          <div>
            <Label className="text-[11px] mb-2 block text-muted-foreground">Obsidian ref</Label>
            <Input
              value={obsidianRef}
              onChange={(e) => setObsidianRef(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSave) save() }}
            />
          </div>
        )}
      </div>

      {/* Save */}
      <Button onClick={save} disabled={!canSave || saving} className="w-full">
        <Plus className="h-4 w-4 mr-1.5" />
        {kind === 'productive'
          ? `Log ${hasMins ? `${mins}m` : ''} to ${selectedDept?.name.replace('Department of ', '') ?? '…'}`
          : `Log ${hasMins ? `${mins}m` : ''} · ${activityLabel}`}
      </Button>
      {kind === 'neutral' && (
        <p className="text-[11px] text-muted-foreground -mt-2">
          Neutral time is evidence, not an assumption. Unlogged minutes remain unknown.
        </p>
      )}
      {kind === 'negative' && (
        <p className="text-[11px] text-muted-foreground -mt-2">
          Negative time counts only when you explicitly log it. Unlogged time is never silently
          treated as failure.
        </p>
      )}
      {needsTarget && !selectedDept && !presetDepartmentId && (
        <p className="text-[11px] text-muted-foreground -mt-2">Pick a department to log productive time.</p>
      )}
    </div>
  )
}
