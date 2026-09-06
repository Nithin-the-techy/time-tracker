'use client'

import { Trash2 } from 'lucide-react'
import { store } from '@/lib/hooks'
import { formatMinutes, entryTimeKey, type EntryWithSub } from '@/lib/metrics'
import { bucketsForRange, type Granularity } from '@/lib/dates'
import { DEPARTMENT_COLORS } from '@/lib/constants'

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
  // Compute buckets covering the range.
  const from = dateFromKey(fromKey)
  const to = dateFromKey(toKey)
  const buckets = bucketsForRange(from, to, granularity)

  // Group entries into buckets by entry date.
  const groups: BucketGroup[] = buckets.map((b) => {
    const bucketEntries = entries.filter((e) => {
      const ek = e.entryTimestamp.slice(0, 10)
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
          <span className="font-medium">{entry.subdepartment.name}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground tabular-nums">{entry.durationMinutes}m</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground tabular-nums">{time || '—'}</span>
        </div>
        {entry.note && <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
      </div>
      <button
        type="button"
        onClick={() => store.deleteEntry(entry.id)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition p-1 -m-1"
        aria-label="Delete entry"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
