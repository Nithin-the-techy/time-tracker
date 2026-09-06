'use client'

// Shared building blocks for every chart: one tooltip style, one grid, one
// number formatting. Keeps all charts visually consistent.

import { Tooltip } from 'recharts'
import { formatHours, formatPercent } from '@/lib/metrics'

export const CHART_COLORS = {
  productive: 'var(--growth)',
  neutral: 'var(--neutral-layer)',
  unproductive: 'var(--depreciation)',
  unknown: '#475569',
  rival: 'oklch(0.55 0.01 60 / 45%)',
} as const

export const tooltipStyle: React.CSSProperties = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--popover-foreground)',
  padding: '6px 10px',
}

export function ChartTooltip(props: Record<string, unknown>) {
  return <Tooltip {...props} contentStyle={tooltipStyle} cursor={{ fill: 'currentColor', fillOpacity: 0.05 }} />
}

export const axisTick = {
  fontSize: 10,
  stroke: 'currentColor',
} as const

export function hoursTick(v: number | string): string {
  const h = Number(v) / 60
  if (h === 0) return '0'
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`
}

// Standard tooltip rows for time charts.
export function timeTooltipRows(
  value: number | string | undefined,
  percent: number | null | undefined,
): [string, string][] {
  const minutes = Number(value ?? 0)
  const rows: [string, string][] = [[formatHours(minutes), 'Productive']]
  if (minutes > 0 && percent != null) {
    rows.push([formatPercent(percent), 'of open time'])
  }
  return rows
}
