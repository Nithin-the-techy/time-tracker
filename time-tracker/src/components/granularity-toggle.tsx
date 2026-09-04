'use client'

import { cn } from '@/lib/utils'
import type { Granularity } from '@/lib/dates'

const OPTIONS: { id: Granularity; label: string }[] = [
  { id: 'day', label: 'Daily' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
  { id: 'year', label: 'Yearly' },
]

interface GranularityToggleProps {
  value: Granularity
  onChange: (g: Granularity) => void
}

export function GranularityToggle({ value, onChange }: GranularityToggleProps) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'px-3 py-1 text-xs font-medium transition',
            value === o.id
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
