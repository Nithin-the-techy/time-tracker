'use client'

import { Trash2 } from 'lucide-react'
import { store, useGoals, useWorkspacePreference } from '@/lib/hooks'
import { formatMinutes, entryTimeKey, type EntryWithSub } from '@/lib/metrics'
import { bucketsForRange, type Granularity } from '@/lib/dates'
import { DEPARTMENT_COLORS } from '@/lib/constants'
import { dateKeyInTimeZone } from '@/lib/dates'
import { useUIStore } from '@/store/ui-store'

interface BucketedLogListProps {
  entries: EntryWithSub[]
  fromKey: string
  toKey: string
  granularity: Granularity
  // Optional: filter to one department (used on Department Page).
  deptId?: string
}

interface BucketGroup {
  label: string
  subLabel: string
  entries: EntryWithSub[]
  totalMinutes: number
}

function dateFromKey(key: string): Date {
  return new Date(key + 'T00:00:00')
}

export function BucketedLogList({ entries, fromKey, toKey, granularity, deptId }: BucketedLogListProps) {
  const { preference } = useWorkspacePreference()
  // Compute buckets covering the range.
  const from = dateFromKey(fromKey)
  const to = dateFromKey(toKey)
  const buckets = bucketsForRange(from, to, granularity)

  // Group entries into buckets by entry date.
  const groups: BucketGroup[] = buckets.map((b) => {
    const bucketEntries = entries.filter((e) => {
      const ek = dateKeyInTimeZone(e.entryTimestamp, preference.timezone)
      return ek >= b.startKey && ek <= b.endKey
    })
    // Sort within bucket: newest first by timestamp.
    bucketEntries.sort((a, b) => b.entryTimestamp.localeCompare(a.entryTimestamp))
    const totalMinutes = bucketEntries.reduce((acc, e) => acc + e.durationMinutes, 0)

    let subLabel = ''
    if (granularity === 'day') {
      subLabel = b.startKey
    } else if (granularity === 'week') {
      subLabel = `${b.startKey} – ${b.endKey}`
    } else if (granularity === 'month') {
      subLabel = b.startKey.slice(0, 7)
    } else {
      subLabel = b.startKey.slice(0, 4)
    }

    return {
      label: b.label,
      subLabel,
      entries: bucketEntries,
      totalMinutes,
    }
  })

  // Filter out empty buckets for compactness in long ranges.
  // But for daily view of recent range, keep empty days so user sees the gap.
  const nonEmpty = groups.filter((g) => g.entries.length > 0)

  // For daily view, also keep empty days if range is short (<=14 days).
  let display = nonEmpty
  if (granularity === 'day') {
    const dayCount = buckets.length
    if (dayCount <= 14) {
      display = groups
    }
  }

  if (display.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">
        No entries in this range.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {display.map((g, idx) => (
        <div key={idx} className="space-y-1.5">
          <div className="flex items-baseline justify-between sticky top-0 bg-background/80 backdrop-blur py-1 -mx-1 px-1 z-10">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium">{g.label}</span>
              <span className="text-[11px] text-muted-foreground">{g.subLabel}</span>
            </div>
            {g.entries.length > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {formatMinutes(g.totalMinutes)} · {g.entries.length} {g.entries.length === 1 ? 'entry' : 'entries'}
              </span>
            )}
          </div>
          <div className="space-y-1">
            {g.entries.length === 0 ? (
              <p className="text-[11px] text-muted-foreground pl-2 italic">— no logs —</p>
            ) : (
              g.entries.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  deptId={deptId}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function EntryRow({
  entry,
  deptId,
}: {
  entry: EntryWithSub
  deptId?: string
}) {
  const time = entryTimeKey(entry)
  const openGoal = useUIStore((state) => state.openGoal)
  const setTab = useUIStore((state) => state.setTab)
  const { goals } = useGoals()
  const sessionRunning = goals.some((goal) => goal.actions.some((action) => action.sessions.some((session) => session.status === 'running')))
  const sessionLabel = sessionRunning
    ? 'Session running · Return to Session'
    : `${entry.sessionContext?.sessionStatus === 'interrupted' ? 'Interrupted · ' : entry.sessionContext?.sessionStatus === 'stopped' ? 'Session ended · ' : 'Session · '}${entry.sessionContext?.sprintName ? `${entry.sessionContext.sprintName} · ` : ''}${entry.sessionContext?.goalTitle} · ${entry.sessionContext?.actionTitle}`
  return (
    <div
      className="flex items-start justify-between gap-2 text-sm border-l-2 pl-3 py-1 group"
      style={{ borderColor: DEPARTMENT_COLORS[entry.department.slug] ?? '#888' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {!deptId && (
            <span className="font-medium">{entry.department.name}</span>
          )}
          <span className="text-muted-foreground">·</span>
          {entry.subdepartment ? <span className="font-medium">{entry.subdepartment.name}</span> : <span className="text-muted-foreground">Area only</span>}
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground tabular-nums">{entry.durationMinutes}m</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground tabular-nums">{time || '—'}</span>
        </div>
        {entry.note && <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
        {entry.sessionContext && <button type="button" onClick={() => { if (sessionRunning) setTab('goals'); else openGoal(entry.sessionContext!.goalId) }} className="mt-1 block max-w-full truncate text-left text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" aria-label={sessionRunning ? 'Return to running Session' : `Open Outcome ${entry.sessionContext.goalTitle}`}>{sessionLabel}</button>}
      </div>
      <button
        type="button"
        onClick={() => store.deleteEntry(entry.id)}
        className="text-muted-foreground hover:text-red-400 transition p-1 -m-1 rounded focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label="Delete entry"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
