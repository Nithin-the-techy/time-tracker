'use client'

import { cn } from '@/lib/utils'
import { useDepartments } from '@/lib/hooks'
import { DEPARTMENT_COLORS } from '@/lib/constants'

interface DepartmentFilterProps {
  value: string | null // null = All
  onChange: (id: string | null) => void
}

export function DepartmentFilter({ value, onChange }: DepartmentFilterProps) {
  const { departments } = useDepartments()
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          'px-2.5 py-1 rounded-md text-xs font-medium border transition',
          value === null
            ? 'bg-foreground text-background border-foreground'
            : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/40',
        )}
      >
        All
      </button>
      {departments.map((d) => {
        const active = value === d.id
        const label = d.name.replace('Department of ', '')
        const compactLabel = label === 'Infrastructure and Strategic Operations' ? 'Infrastructure & Ops' : label
        return (
          <button
            key={d.id}
            type="button"
            title={label}
            aria-label={label}
            onClick={() => onChange(d.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition',
              active
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/40',
            )}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: DEPARTMENT_COLORS[d.slug] ?? '#888' }}
            />
            {compactLabel}
          </button>
        )
      })}
    </div>
  )
}
