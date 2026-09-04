'use client'

// Three-layer day/range composition: Productive / Neutral / Unproductive.
// One shared design, reused on the Progress and Dashboard tabs.

import { formatHours, formatPercent } from '@/lib/metrics'
import { CHART_COLORS } from './charts/kit'

export interface Composition {
  productive: number
  neutral: number
  unproductive: number
  productivePercent: number | null
}

const LAYERS = [
  { key: 'productive', label: 'Productive', color: CHART_COLORS.productive },
  { key: 'neutral', label: 'Neutral', color: CHART_COLORS.neutral },
  { key: 'unproductive', label: 'Unproductive', color: CHART_COLORS.unproductive },
] as const

export function CompositionBar({ data }: { data: Composition }) {
  const total = data.productive + data.neutral + data.unproductive

  // Blank state: nothing logged in the range → an empty track and a plain
  // "no data" line. Never a full-red bar implying a wasted day.
  if (total === 0) {
    return (
      <div>
        <div className="h-3 w-full rounded-full bg-muted/50 border border-dashed border-border/60" />
        <p className="text-xs text-muted-foreground/70 mt-2">
          Nothing logged in this range yet — this fills in as you log. Unlogged days are not counted against you.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
        {LAYERS.map((layer) => {
          const minutes = data[layer.key]
          if (minutes <= 0) return null
          const pct = total > 0 ? (minutes / total) * 100 : 0
          return (
            <div
              key={layer.key}
              className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${Math.max(pct, 1.5)}%`, backgroundColor: layer.color }}
              title={`${layer.label} ${formatHours(minutes)}`}
            />
          )
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {LAYERS.map((layer) => (
          <span key={layer.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: layer.color }} />
            {layer.label}
            <span className="tabular-nums text-foreground">{formatHours(data[layer.key])}</span>
            {layer.key === 'productive' && data.productivePercent !== null && (
              <span className="tabular-nums">({formatPercent(data.productivePercent)})</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
