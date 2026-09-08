'use client'

// Standings: you + every rival on one ranked list of proportional bars.
// Everyone measured by the same yardstick — monthly GPP (productive time
// valued at the same $/h). Hours shown alongside. You are gold.

import { formatMoney } from '@/lib/metrics'
import { CHART_COLORS } from './kit'
import { cn } from '@/lib/utils'

export interface Standing {
  id: string
  name: string
  gppDollars: number
  monthlyHours: number
  isMe?: boolean
}

export function StandingsChart({ data, onManage }: { data: Standing[]; onManage?: () => void }) {
  const ranked = [...data].sort((a, b) => b.gppDollars - a.gppDollars)
  const max = Math.max(...ranked.map((r) => r.gppDollars), 1)
  const hasRivals = ranked.some((r) => !r.isMe)

  return (
    <div className="space-y-2.5">
      {ranked.map((r, i) => (
        <div key={r.id}>
          <div className="flex items-baseline justify-between mb-1">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-xs text-muted-foreground tabular-nums w-4">{i + 1}.</span>
              <span className={cn('text-sm truncate', r.isMe ? 'font-medium text-[var(--growth)]' : 'text-foreground')}>
                {r.name}
              </span>
              {r.isMe && r.name.toLowerCase() !== 'you' && <span className="text-[10px] text-muted-foreground">you</span>}
            </div>
            <span className={cn('text-sm tabular-nums', r.isMe ? 'text-[var(--growth)]' : 'text-foreground')}>
              {formatMoney(r.gppDollars)}
              <span className="text-muted-foreground">/mo</span>
              <span className="text-muted-foreground/70"> · {Math.round(r.monthlyHours)}h</span>
            </span>
          </div>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(2, (r.gppDollars / max) * 100)}%`,
                backgroundColor: r.isMe ? CHART_COLORS.productive : CHART_COLORS.rival,
              }}
            />
          </div>
        </div>
      ))}

      {!hasRivals && onManage && (
        <button
          type="button"
          onClick={onManage}
          className="text-xs text-muted-foreground hover:text-foreground transition pt-1"
        >
          Add rivals in Settings →
        </button>
      )}
      {hasRivals && onManage && (
        <button
          type="button"
          onClick={onManage}
          className="text-xs text-muted-foreground hover:text-foreground transition pt-1"
        >
          Manage rivals →
        </button>
      )}
    </div>
  )
}
