'use client'

// Database tab — pure data organization: department index and range browsing.
// No motivational elements here; the day/week live view is on the Progress tab,
// and logging happens through the one universal + button.

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEntriesInRange, useDepartments, useAllowances } from '@/lib/hooks'
import {
  rangeMetrics,
  bucketSeries,
  departmentShares,
  allowanceMap,
  lastActiveLabel,
  formatHours,
  type EntryWithSub,
} from '@/lib/metrics'
import { DEPARTMENT_COLORS } from '@/lib/constants'
import {
  toKey,
  bucketsForRange,
} from '@/lib/dates'
import { useUIStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'
import { HoursBarChart } from '@/components/charts/hours-bar-chart'
import { CompositionBar } from '@/components/composition-bar'
import { DateRangePicker } from '@/components/date-range-picker'
import { GranularityToggle } from '@/components/granularity-toggle'
import { DepartmentFilter } from '@/components/department-filter'
import { BucketedLogList } from '@/components/bucketed-log-list'

const GRAN_LABEL = { day: 'day', week: 'week', month: 'month', year: 'year' } as const

export function DatabaseScreen() {
  const { departments } = useDepartments()

  const browseFrom = useUIStore((s) => s.browseFrom)
  const browseTo = useUIStore((s) => s.browseTo)
  const browseGranularity = useUIStore((s) => s.browseGranularity)
  const setBrowseRange = useUIStore((s) => s.setBrowseRange)
  const setBrowseGranularity = useUIStore((s) => s.setBrowseGranularity)
  const browseDeptFilter = useUIStore((s) => s.browseDeptFilter)
  const setBrowseDeptFilter = useUIStore((s) => s.setBrowseDeptFilter)
  const openDeptPage = useUIStore((s) => s.openDeptPage)

  const { allowances } = useAllowances()
  const allow = useMemo(() => allowanceMap(allowances), [allowances])

  // Browse range
  const { entries: browseEntriesAll } = useEntriesInRange(browseFrom, browseTo)
  const browseEntries = browseDeptFilter
    ? browseEntriesAll.filter((e) => e.departmentId === browseDeptFilter)
    : browseEntriesAll

  const range = rangeMetrics(browseEntriesAll as unknown as EntryWithSub[], browseFrom, browseTo, allow)

  const buckets = useMemo(
    () => bucketsForRange(
      new Date(browseFrom + 'T00:00:00'),
      new Date(browseTo + 'T23:59:59'),
      browseGranularity,
    ),
    [browseFrom, browseTo, browseGranularity],
  )

  // Chart uses the dept-filtered entries so the graph matches the filter.
  const chartData = useMemo(
    () => bucketSeries(browseEntries as unknown as EntryWithSub[], buckets, allow),
    [browseEntries, buckets, allow],
  )

  // Full history for last-active + total hours per department.
  const { entries: allEntriesEver } = useEntriesInRange('2000-01-01', '2099-12-31')
  const shares = departmentShares(allEntriesEver as unknown as EntryWithSub[])
  const sharesBySlug = new Map(shares.map((s) => [s.slug, s]))

  const deptsWithStats = departments
    .map((d) => {
      const s = sharesBySlug.get(d.slug)
      return {
        ...d,
        minutes: s?.minutes ?? 0,
        share: s?.shareOfGpp ?? 0,
        daysActive: s?.daysActive ?? 0,
        lastActive: lastActiveLabel(allEntriesEver as unknown as EntryWithSub[], d.id),
      }
    })
    .sort((a, b) => b.minutes - a.minutes)

  return (
    <div className="space-y-8">
      {/* Departments */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-sm text-muted-foreground">Departments</p>
          <span className="text-xs text-muted-foreground">open for details</span>
        </div>
        {deptsWithStats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading departments…</p>
        ) : (
          <div className="border-t border-border">
            {deptsWithStats.map((d) => (
              <DepartmentRow
                key={d.id}
                slug={d.slug}
                name={d.name}
                minutes={d.minutes}
                share={d.share}
                daysActive={d.daysActive}
                subCount={d.subdepartments.length}
                lastActive={d.lastActive}
                onClick={() => openDeptPage(d.slug)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Browse */}
      <section>
        <p className="text-sm text-muted-foreground mb-3">Browse</p>
        <div className="space-y-3">
          <DateRangePicker
            fromKey={browseFrom}
            toKey={browseTo}
            onChange={(from, to) => setBrowseRange(from, to)}
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">Bucket by</span>
            <GranularityToggle value={browseGranularity} onChange={setBrowseGranularity} />
          </div>
          <DepartmentFilter value={browseDeptFilter} onChange={setBrowseDeptFilter} />

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-3">
                Time composition · {range.productivePercent !== null ? `${Math.round(range.productivePercent)}% productive` : 'no data'}
                <span className="text-muted-foreground/70"> · {formatHours(range.available)} open</span>
              </p>
              <CompositionBar data={range} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Hours by {GRAN_LABEL[browseGranularity]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {range.productive === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No entries in this range.</p>
              ) : (
                <HoursBarChart data={chartData} height={260} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Logs in range</CardTitle>
            </CardHeader>
            <CardContent>
              <BucketedLogList
                entries={browseEntries}
                fromKey={browseFrom}
                toKey={browseTo}
                granularity={browseGranularity}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

function DepartmentRow({
  slug,
  name,
  minutes,
  share,
  daysActive,
  subCount,
  lastActive,
  onClick,
}: {
  slug: string
  name: string
  minutes: number
  share: number
  daysActive: number
  subCount: number
  lastActive: string
  onClick: () => void
}) {
  const color = DEPARTMENT_COLORS[slug] ?? '#888'

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left border-b border-border py-3 grid grid-cols-12 gap-2 items-baseline hover:bg-muted/20 transition"
    >
      <div className="col-span-5 flex items-center gap-2 min-w-0">
        <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="font-serif text-base truncate">{name}</span>
      </div>
      <div className="col-span-2 text-sm text-muted-foreground tabular-nums">
        {subCount} subs
      </div>
      <div className="col-span-3 text-right">
        <span className="font-serif text-lg tabular-nums text-[var(--growth)]">{formatHours(minutes)}</span>
        <span className="text-xs text-muted-foreground ml-1.5 tabular-nums">· {Math.round(share)}%</span>
      </div>
      <div className="col-span-2 text-right text-xs text-muted-foreground tabular-nums">
        {lastActive === 'never' ? (
          <span>{daysActive > 0 ? `${daysActive} days` : 'no logs'}</span>
        ) : (
          <span>last active {lastActive}</span>
        )}
      </div>
    </button>
  )
}
