'use client'

// Progress tab — where you are right now and how the window is going.
//
// The hero row carries TWO equally big, window-independent numbers:
//   Left   — GPP: every productive minute ever logged, averaged per tracked
//            day, extended to a month, valued at GPP_DOLLARS_PER_HOUR.
//            Calibrated so $1T/month = 14 productive hours every day — the
//            physical ceiling of a top-performing human. Computed from ALL
//            data, so it reads the same in Day+Week, Month and Year.
//   Right  — productive hours across the last 30 days (span clamped to when
//            tracking started), with hours/day and the real date span.
//
// Below, one switch and ONE unified composition view:
//   Day + Week (default) — today's donut beside the rolling-week donut,
//                          beside stacked hours-by-day bars.
//   Month                — last-30-days donut beside hours-by-week bars.
//   Year                 — last-12-months donut beside hours-by-month bars.
// Every donut shows ALL time: productive departments, neutral activities,
// negative activities, unaccounted. The stacked bars show the same three-way
// split across time. No separate stat tiles, no tags, no per-day edit rows —
// logging (all three kinds) lives in the universal log, per-day sleep/neutral
// pins live in Settings.
//
// Rolling windows on purpose: no Monday/month jumps, the label always shows
// the real date span. Rivals are compared by monthly GPP on equal footing.

import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  useEntriesInRange,
  useAllEntries,
  useRivals,
  useAllowances,
  useNeutralEntries,
  useUnproductiveBlocks,
} from '@/lib/hooks'
import {
  dayMetrics,
  bucketSeries,
  projectDay,
  allowanceMap,
  compositionForRange,
  gppStats,
  trailingProductive,
  formatHours,
  formatMinutes,
  formatPercent,
  formatMoney,
  formatGoalPercent,
  type EntryWithSub,
  type DayProjection,
} from '@/lib/metrics'
import {
  toKey,
  addDays,
  bucketsForRange,
  rangeLabel,
  prettyDate,
  type Bucket,
} from '@/lib/dates'
import { GPP_DOLLARS_PER_HOUR } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { HoursBarChart } from '@/components/charts/hours-bar-chart'
import { CompositionDonut } from '@/components/charts/composition-donut'
import { StandingsChart, type Standing } from '@/components/charts/standings-chart'
import { useUIStore, type ProgressMode } from '@/store/ui-store'

const WINDOW_DAYS: Record<ProgressMode, number> = { dayweek: 7, month: 30, year: 365 }

const GPP_TOOLTIP =
  'GPP — Gross Personal Product, computed like nominal GDP: all productive time ever logged, averaged over every day tracked so far, extended to a month. The scale: $1T a month is 14 productive hours every single day — the physical ceiling of a top-performing human (7h sleep, 1.5h recovery, under 2h wasted). Your number is your honest fraction of that. One formula, one input (all your data) — the same number in every view.'

export function ProgressScreen() {
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const todayKey = toKey(now)

  const mode = useUIStore((s) => s.progressMode)
  const setProgressMode = useUIStore((s) => s.setProgressMode)
  const setTab = useUIStore((s) => s.setTab)

  const days = WINDOW_DAYS[mode]
  const winFrom = toKey(addDays(now, -(days - 1)))
  const winTo = todayKey

  const { allowances } = useAllowances()
  const { neutralEntries } = useNeutralEntries()
  const { blocks } = useUnproductiveBlocks()
  const allow = useMemo(() => allowanceMap(allowances), [allowances])

  const { entries: todayEntries } = useEntriesInRange(todayKey, todayKey)
  const { entries: winEntries } = useEntriesInRange(winFrom, winTo)
  const { entries: allEntries } = useAllEntries()
  const { rivals } = useRivals()

  // GPP + the trailing-30 headline: computed once from ALL data. Deliberately
  // independent of `mode` — switching windows never moves these numbers.
  const g = useMemo(() => gppStats(allEntries as unknown as EntryWithSub[], new Date()), [allEntries])
  const t30 = useMemo(() => trailingProductive(allEntries as unknown as EntryWithSub[], 30, new Date()), [allEntries])

  const todayM = dayMetrics(todayEntries as unknown as EntryWithSub[], todayKey, allow, neutralEntries)
  const m = useMemo(
    () =>
      compositionForRange(
        winEntries as unknown as EntryWithSub[],
        blocks,
        winFrom,
        winTo,
        allow,
        neutralEntries,
      ),
    [winEntries, blocks, winFrom, winTo, allow, neutralEntries],
  )
  const totals = m.totals

  // Pace projection only makes sense for the day in progress.
  const proj: DayProjection | null = mode === 'dayweek' ? projectDay(todayM, nowMinutes) : null

  const buckets = useMemo(
    () => progressBuckets(mode, winFrom, winTo),
    [mode, winFrom, winTo],
  )

  const chartData = useMemo(
    () => bucketSeries(winEntries as unknown as EntryWithSub[], buckets, allow, neutralEntries),
    [winEntries, buckets, allow, neutralEntries],
  )

  const todaySlices = useMemo(
    () =>
      compositionForRange(
        winEntries as unknown as EntryWithSub[],
        blocks,
        todayKey,
        todayKey,
        allow,
        neutralEntries,
      ).slices,
    [winEntries, blocks, todayKey, allow, neutralEntries],
  )

  const standings: Standing[] = useMemo(() => {
    // Everyone on the same monthly-GPP scale. Rivals come from weekly
    // estimates → weekly minutes ÷ 7 × 30 → × $/h. Mine is the real GPP.
    const rivalRows = rivals.map((r) => {
      const weeklyMinutes = r.sectorEstimates.reduce((acc, est) => acc + est.estimatedWeeklyMinutes, 0)
      const monthlyMinutes = (weeklyMinutes / 7) * 30
      return {
        id: r.id,
        name: r.name,
        gppDollars: (monthlyMinutes / 60) * GPP_DOLLARS_PER_HOUR,
        monthlyHours: monthlyMinutes / 60,
        isMe: false,
      }
    })
    return [
      { id: '__me__', name: 'You', gppDollars: g.monthlyDollars, monthlyHours: g.monthlyHours, isMe: true },
      ...rivalRows,
    ]
  }, [rivals, g])

  const winLabel = rangeLabel(new Date(winFrom + 'T00:00:00'), new Date(winTo + 'T00:00:00'))
  const windowName = mode === 'dayweek' ? 'last 7 days' : mode === 'month' ? 'last 30 days' : 'last 12 months'
  const hoursTitle = mode === 'dayweek' ? 'Hours by day' : mode === 'month' ? 'Hours by week' : 'Hours by month'

  return (
    <div className="space-y-8">
      {/* Hero row — GPP left, trailing-30 right, both big, both window-independent */}
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
        <div>
          <p className="text-sm text-muted-foreground mb-1" title={GPP_TOOLTIP}>
            GPP · gross personal product
          </p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-serif text-6xl tracking-tight tabular-nums text-[var(--growth)]">
              {formatMoney(g.monthlyDollars)}
            </h1>
            <span className="text-sm text-muted-foreground">/ month</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            ≈ <span className="text-foreground tabular-nums">{Math.round(g.monthlyHours)}h</span> productive a
            month · {formatHours(g.avgPerDayMinutes)}/day across {g.daysTracked} tracked {g.daysTracked === 1 ? 'day' : 'days'}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {formatGoalPercent(g.goalPercent)} of the $1T/month goal · on pace for {formatMoney(g.annualDollars)} a year
          </p>
        </div>

        <div className="md:text-right">
          <p className="text-sm text-muted-foreground mb-1">Productive · last {t30.days} {t30.days === 1 ? 'day' : 'days'}</p>
          <div className="flex items-baseline gap-3 flex-wrap md:justify-end">
            <h2 className="font-serif text-6xl tracking-tight tabular-nums text-foreground">
              {bigHours(t30.productiveMinutes)}
            </h2>
          </div>
          {t30.productiveMinutes > 0 ? (
            <p className="text-xs text-muted-foreground mt-1.5">
              {t30.hoursPerDay.toFixed(1)}h a day · {prettyDate(new Date(t30.fromKey + 'T00:00:00'))} to{' '}
              {prettyDate(new Date(t30.toKey + 'T00:00:00'))}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1.5">log your first session to start the count</p>
          )}
        </div>
      </div>

      {/* Window switch — affects the charts below only, never the hero */}
      <div className="flex justify-end">
        <ModeSwitch value={mode} onChange={setProgressMode} />
      </div>

      {/* Unified composition: donut(s) + stacked bars */}
      {mode === 'dayweek' ? (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-sm font-medium">Today</p>
                  <p className="text-[11px] text-muted-foreground">
                    {todayM.productive > 0 ? `${formatMinutes(todayM.productive)} logged` : 'nothing logged yet'}
                  </p>
                </div>
                <CompositionDonut
                  slices={todaySlices}
                  height={200}
                  centerPrimary={todayM.productivePercent !== null ? formatPercent(todayM.productivePercent) : '—'}
                  centerSecondary="of open time"
                />
                {proj ? (
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    pace{' '}
                    <span className="text-[var(--growth)] tabular-nums">
                      (→ {formatHours(proj.productive)} productive · {formatHours(proj.unproductive)} unproductive)
                    </span>{' '}
                    by tonight
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {todayM.productive > 0
                      ? `${formatPercent(todayM.productivePercent)} of open time so far`
                      : 'nothing logged yet — the day fills in only as you log'}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-sm font-medium">Last 7 days</p>
                  <p className="text-[11px] text-muted-foreground">{winLabel}</p>
                </div>
                <CompositionDonut
                  slices={m.slices}
                  height={200}
                  centerPrimary={formatPercent(totals.productivePercent)}
                  centerSecondary="productive"
                />
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                  {formatHours(totals.productive)} productive · {formatHours(totals.neutral)} neutral ·{' '}
                  {formatHours(totals.unproductive)} unproductive
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-sm font-medium">Hours by day</p>
                <p className="text-[11px] text-muted-foreground">last 7 days · stacked productive / neutral / unproductive</p>
              </div>
              <HoursBarChart data={chartData} height={240} />
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-sm font-medium">Composition</p>
                <p className="text-[11px] text-muted-foreground">{windowName} · {winLabel}</p>
              </div>
              <CompositionDonut
                slices={m.slices}
                height={235}
                centerPrimary={formatPercent(totals.productivePercent)}
                centerSecondary="productive"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-sm font-medium">{hoursTitle}</p>
                <p className="text-[11px] text-muted-foreground">{windowName}</p>
              </div>
              <HoursBarChart data={chartData} height={235} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Standings — monthly GPP, same treatment for everyone */}
      <section>
        <p className="text-sm text-muted-foreground mb-3">
          Standings · monthly GPP at {formatMoney(GPP_DOLLARS_PER_HOUR)} per productive hour
          <span className="text-muted-foreground/70"> · $1T = 14h/day, every day · rivals from weekly estimates</span>
        </p>
        <Card>
          <CardContent className="p-4">
            <StandingsChart data={standings} onManage={() => setTab('settings')} />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

// Headline formatting for the right-hand number: hours, never "0m".
function bigHours(minutes: number): string {
  const h = minutes / 60
  if (h < 10) return `${h.toFixed(1)}h`
  return `${Math.round(h)}h`
}

// Day + week windows use day buckets; 30d uses week buckets labeled with their
// full span (so a week straddling two months reads plainly); 365d uses months.
// Buckets are clamped to the window so partial weeks don't leak outside it.
function progressBuckets(mode: ProgressMode, fromKey: string, toKey: string): Bucket[] {
  const from = new Date(fromKey + 'T00:00:00')
  const to = new Date(toKey + 'T23:59:59')
  const clamp = (bs: Bucket[]) =>
    bs.map((b) => ({
      ...b,
      startKey: b.startKey < fromKey ? fromKey : b.startKey,
      endKey: b.endKey > toKey ? toKey : b.endKey,
    }))

  if (mode === 'dayweek') return bucketsForRange(from, to, 'day')
  if (mode === 'year') return clamp(bucketsForRange(from, to, 'month'))

  return clamp(bucketsForRange(from, to, 'week')).map((b) => ({
    ...b,
    label: `${prettyDate(new Date(b.startKey + 'T00:00:00'))} – ${prettyDate(new Date(b.endKey + 'T00:00:00'))}`,
  }))
}

function ModeSwitch({ value, onChange }: { value: ProgressMode; onChange: (m: ProgressMode) => void }) {
  const modes: { id: ProgressMode; label: string }[] = [
    { id: 'dayweek', label: 'Day + Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
  ]
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={cn(
            'px-3 py-1.5 text-xs rounded-md transition',
            value === m.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
