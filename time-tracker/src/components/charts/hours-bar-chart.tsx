'use client'

// Vertical bars of hours per bucket.
//
// Stacked mode (default) shows where time went in full: productive (gold) +
// neutral (grey) + unproductive (red) — the level of "badness" per bucket is
// the red share of each bar. Single mode (department pages) keeps the classic
// one-metric bar in the department color.
//
// Single axis, fixed height — no dual-axis hacks (those caused clipped bars).

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { CHART_COLORS, ChartTooltip, axisTick, hoursTick } from './kit'
import { formatHours, formatPercent } from '@/lib/metrics'
import type { BucketDatum } from '@/lib/metrics'

interface HoursBarChartProps {
  data: BucketDatum[]
  height?: number
  color?: string
  stacked?: boolean
}

export function HoursBarChart({ data, height = 240, color, stacked = true }: HoursBarChartProps) {
  // Only logged time renders. Buckets with nothing logged are not "zero"
  // bars — they don't exist. The chart fills up as more days get logged.
  const visible = data.filter((d) => d.hasEntries)

  if (visible.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground/70"
        style={{ height }}
      >
        Nothing logged in this range yet — bars appear as you log days.
      </div>
    )
  }

  if (!stacked) {
    return (
      <div style={{ width: '100%', height }} className="text-muted-foreground">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={visible} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.12} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} tick={axisTick} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={38}
              allowDecimals={false}
              tick={axisTick}
              tickFormatter={hoursTick}
            />
            <ChartTooltip
              formatter={(value: number | string, _name: string, item: { payload?: BucketDatum }) => {
                const payload = item?.payload
                const rows: [string, string][] = [
                  [payload?.hasEntries ? formatHours(Number(value ?? 0)) : 'No entries', 'Productive'],
                ]
                if (payload?.hasEntries && payload?.productivePercent != null) {
                  rows.push([formatPercent(payload.productivePercent), 'of open time'])
                }
                return rows
              }}
            />
            <Bar
              dataKey="productive"
              fill={color ?? CHART_COLORS.productive}
              radius={[3, 3, 0, 0]}
              maxBarSize={44}
              isAnimationActive={false}
              name="productive"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }} className="text-muted-foreground">
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.productive }} />
          Productive
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.neutral }} />
          Neutral
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.unproductive }} />
          Unproductive
        </span>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={visible} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.12} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} tick={axisTick} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={38}
              allowDecimals={false}
              tick={axisTick}
              tickFormatter={hoursTick}
            />
            <ChartTooltip
              formatter={(value: number | string, name: string, item: { payload?: BucketDatum }) => {
                const payload = item?.payload
                if (!payload) return [[formatHours(Number(value ?? 0)), name]] as [string, string][]
                const total = payload.productive + payload.neutral + payload.unproductive
                const pct = total > 0 ? Math.round((Number(value) / total) * 100) : 0
                return [
                  [formatHours(Number(value ?? 0)), `${name} · ${pct}%`],
                ] as [string, string][]
              }}
            />
            <Bar dataKey="productive" stackId="t" fill={CHART_COLORS.productive} maxBarSize={44} isAnimationActive={false} name="Productive" />
            <Bar dataKey="neutral" stackId="t" fill={CHART_COLORS.neutral} maxBarSize={44} isAnimationActive={false} name="Neutral" />
            <Bar dataKey="unproductive" stackId="t" fill={CHART_COLORS.unproductive} radius={[3, 3, 0, 0]} maxBarSize={44} isAnimationActive={false} name="Unproductive" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
