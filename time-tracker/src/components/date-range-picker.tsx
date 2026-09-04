'use client'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  QUICK_RANGES,
  quickRange,
  rangeLabel,
  toKey,
  type QuickRangeId,
} from '@/lib/dates'

interface DateRangePickerProps {
  fromKey: string
  toKey: string
  onChange: (from: string, to: string) => void
  // When true, the "all" quick range is hidden (used on department pages —
  // "all time" still works but it's clearer to show this list).
  showAllTime?: boolean
}

export function DateRangePicker({
  fromKey,
  toKey: toKeyEnd,
  onChange,
  showAllTime = true,
}: DateRangePickerProps) {
  const fromDate = new Date(fromKey + 'T00:00:00')
  const toDate = new Date(toKeyEnd + 'T23:59:59')

  function applyQuick(id: QuickRangeId) {
    const { from, to } = quickRange(id)
    onChange(toKey(from), toKey(to))
  }

  const quickIds: QuickRangeId[] = showAllTime
    ? ['today', 'yesterday', 'last7', 'last30', 'thisWeek', 'thisMonth', 'thisYear', 'all']
    : ['today', 'yesterday', 'last7', 'last30', 'thisWeek', 'thisMonth', 'thisYear']

  return (
    <div className="space-y-2">
      {/* From → To inline pickers */}
      <div className="flex items-center gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="font-normal">
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
              <span className="text-muted-foreground mr-1">From</span>
              <span>{fromKey}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={fromDate}
              onSelect={(d) => {
                if (!d) return
                const newFrom = toKey(d)
                if (newFrom > toKeyEnd) {
                  onChange(newFrom, newFrom)
                } else {
                  onChange(newFrom, toKeyEnd)
                }
              }}
              disabled={(d) => d > new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="font-normal">
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
              <span className="text-muted-foreground mr-1">To</span>
              <span>{toKeyEnd}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={toDate}
              onSelect={(d) => {
                if (!d) return
                const newTo = toKey(d)
                if (newTo < fromKey) {
                  onChange(newTo, newTo)
                } else {
                  onChange(fromKey, newTo)
                }
              }}
              disabled={(d) => d > new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Quick ranges */}
      <div className="flex flex-wrap gap-1">
        {quickIds.map((id) => {
          const q = QUICK_RANGES.find((x) => x.id === id)!
          return (
            <button
              key={id}
              type="button"
              onClick={() => applyQuick(id)}
              className="px-2 py-1 rounded-md border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
            >
              {q.label}
            </button>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {rangeLabel(fromDate, toDate)}
      </p>
    </div>
  )
}
