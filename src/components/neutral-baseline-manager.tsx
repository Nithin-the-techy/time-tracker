'use client'

// Per-day neutral baseline manager — lives in Settings.
//
// A day's neutral time = logged/pinned sleep + logged/pinned other neutral.
// Either part can be PINNED to an explicit value for one specific date here.
// Pins win over logs — and every chart, total and
// projection reads the same numbers.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Plus, RotateCcw, X } from 'lucide-react'
import { store, useAllowances } from '@/lib/hooks'
import { toKey, prettyDateWithYear } from '@/lib/dates'
import { toast } from 'sonner'

export function NeutralBaselineManager() {
  const { allowances } = useAllowances()
  const sorted = [...allowances].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="space-y-3">

      {sorted.length > 0 && (
        <div className="space-y-1">
          {sorted.map((a) => (
            <div
              key={a.date}
              className="flex items-center justify-between gap-2 text-xs py-1.5 border-l-2 border-border pl-2 group"
            >
              <div className="min-w-0">
                <span className="font-medium tabular-nums">{prettyDateWithYear(new Date(a.date + 'T00:00:00'))}</span>
                <span className="text-muted-foreground ml-2 tabular-nums">
                  sleep {a.sleepMinutes != null ? `${Math.round(a.sleepMinutes / 60 * 10) / 10}h` : '—'} · neutral{' '}
                  {a.neutralMinutes != null ? `${a.neutralMinutes}m` : '—'}
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await store.clearAllowance(a.date)
                    toast.success('Pin removed; logged data is authoritative again')
                  } catch (e) {
                    toast.error((e as Error).message)
                  }
                }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[var(--depreciation)] transition p-1 -m-1"
                aria-label={`Reset ${a.date}`}
                title="Remove pin"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AddAllowanceForm />
    </div>
  )
}

function AddAllowanceForm() {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<Date>(new Date())
  const [sleep, setSleep] = useState('')
  const [neutral, setNeutral] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const s = sleep.trim() === '' ? null : Math.max(0, Math.round(Number(sleep)))
    const n = neutral.trim() === '' ? null : Math.max(0, Math.round(Number(neutral)))
    if (s === null && n === null) return
    setSaving(true)
    try {
      await store.setAllowance({
        date: toKey(date),
        ...(s !== null ? { sleepMinutes: Math.min(s, 840) } : {}),
        ...(n !== null ? { neutralMinutes: Math.min(n, 600) } : {}),
      })
      toast.success('Day pinned')
      setSleep('')
      setNeutral('')
      setOpen(false)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="text-xs h-8">
          <Plus className="h-3.5 w-3.5 mr-1" /> Pin a specific day
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-3 border border-border rounded-md bg-muted/20">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[11px] mb-1 block text-muted-foreground">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal h-9 text-xs">
                <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                {toKey(date) === toKey(new Date()) ? 'Today' : toKey(date)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                disabled={(d) => d > new Date() || d < new Date(new Date().setFullYear(new Date().getFullYear() - 1))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <label className="space-y-1">
          <span className="text-[11px] text-muted-foreground block">Sleep (min)</span>
          <Input
            type="number"
            min={0}
            max={840}
            placeholder="optional"
            value={sleep}
            onChange={(e) => setSleep(e.target.value)}
            className="h-9"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-muted-foreground block">Neutral (min)</span>
          <Input
            type="number"
            min={0}
            max={600}
            placeholder="optional"
            value={neutral}
            onChange={(e) => setNeutral(e.target.value)}
            className="h-9"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving || (sleep.trim() === '' && neutral.trim() === '')} size="sm">
          Save pin
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
