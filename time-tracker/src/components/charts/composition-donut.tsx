'use client'

// The one composition chart. Every kind of time in a single donut —
// productive departments (own colors, clickable), neutral activities
// (grey-blue family), negative activities (red family) and the unaccounted
// remainder — with extra gaps between the kind groups so the positive /
// neutral / negative partition reads at a glance.
//
// Replaces the old department-only pie AND the three-layer composition bar:
// same data, one representation, no redundancy.

import { useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { formatHours } from '@/lib/metrics'
import type { CompositionSlice, SliceKind } from '@/lib/metrics'
import { useUIStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'

const KIND_HEADERS: Record<SliceKind, string> = {
  productive: 'Productive',
  neutral: 'Neutral',
  negative: 'Negative',
}

interface PieItem extends CompositionSlice {
  isSpacer?: boolean
}

export function CompositionDonut({
  slices,
  height = 230,
  centerPrimary,
  centerSecondary,
  className,
}: {
  slices: CompositionSlice[]
  height?: number
  centerPrimary: string
  centerSecondary: string
  className?: string
}) {
  const openDeptPage = useUIStore((s) => s.openDeptPage)
  const [hover, setHover] = useState<number | null>(null) // index into slices

  const total = slices.reduce((a, d) => a + d.minutes, 0)

  // Insert transparent spacers at kind boundaries → visible gaps between the
  // positive / neutral / negative groups (distortion < 1°, value-level only).
  const pieData: PieItem[] = []
  slices.forEach((s, i) => {
    if (pieData.length > 0 && pieData[pieData.length - 1].kind !== s.kind) {
      pieData.push({ ...s, minutes: Math.max(1, total * 0.012), key: `spacer-${s.key}`, isSpacer: true })
    }
    pieData.push({ ...s, sliceIndex: i } as PieItem & { sliceIndex: number })
  })

  const focused = hover !== null ? slices[hover] : null
  const focusedShare = focused && total > 0 ? Math.round((focused.minutes / total) * 100) : null

  // Group legend rows by kind, preserving slice order.
  const legendGroups: { kind: SliceKind; rows: { slice: CompositionSlice; index: number }[] }[] = []
  slices.forEach((slice, index) => {
    const last = legendGroups[legendGroups.length - 1]
    if (last && last.kind === slice.kind) last.rows.push({ slice, index })
    else legendGroups.push({ kind: slice.kind, rows: [{ slice, index }] })
  })

  return (
    <div className={cn('flex flex-col md:flex-row items-center gap-4 min-w-0', className)}>
      <div className="relative w-full md:w-[46%] shrink-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="minutes"
              nameKey="label"
              innerRadius="64%"
              outerRadius="94%"
              paddingAngle={1.2}
              startAngle={90}
              endAngle={-270}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
              onMouseEnter={(_: unknown, i: number) => {
                const item = pieData[i] as (PieItem & { sliceIndex?: number }) | undefined
                if (item && !item.isSpacer && typeof item.sliceIndex === 'number') setHover(item.sliceIndex)
              }}
              onMouseLeave={() => setHover(null)}
            >
              {pieData.map((d) => (
                <Cell
                  key={d.key}
                  fill={d.isSpacer ? 'transparent' : d.color}
                  strokeWidth={d.isSpacer ? 0 : 2}
                  opacity={hover === null || d.key === focused?.key ? 1 : 0.35}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-serif text-2xl tabular-nums text-foreground leading-tight">
            {focused ? formatHours(focused.minutes) : centerPrimary}
          </span>
          <span className="text-[10px] text-muted-foreground max-w-[110px] text-center leading-tight">
            {focused ? (
              <>
                {focused.label}
                {focusedShare !== null && <> · {focusedShare}%</>}
              </>
            ) : (
              centerSecondary
            )}
          </span>
        </div>
      </div>

      {/* Legend, grouped by kind: the positive / neutral / negative partition */}
      <div className="w-full md:flex-1 min-w-0 space-y-2.5">
        {legendGroups.map((group) => (
          <div key={group.kind}>
            <p className="text-[10px] tracking-wide text-muted-foreground/70 mb-0.5">
              {KIND_HEADERS[group.kind]}
            </p>
            <div className="space-y-px">
              {group.rows.map(({ slice, index }) => {
                const share = total > 0 ? Math.round((slice.minutes / total) * 100) : 0
                const clickable = !!slice.slug
                return (
                  <button
                    key={slice.key}
                    type="button"
                    onMouseEnter={() => setHover(index)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => slice.slug && openDeptPage(slice.slug)}
                    disabled={!clickable}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1 rounded-md transition text-left min-w-0',
                      clickable && 'hover:bg-muted/40',
                      hover !== null && hover !== index && 'opacity-50',
                    )}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="text-xs truncate flex-1 min-w-0">{slice.label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground shrink-0">{formatHours(slice.minutes)}</span>
                    <span className="text-xs tabular-nums w-9 text-right text-muted-foreground shrink-0">{share}%</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
