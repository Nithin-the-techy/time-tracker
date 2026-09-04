// Date helpers — all in the user's local timezone. No UTC drift.

export type Granularity = 'day' | 'week' | 'month' | 'year'

// --- Basic start-of / end-of helpers ---

export function startOfWeek(d: Date): Date {
  const out = new Date(d)
  const day = out.getDay() // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day // shift to Monday
  out.setDate(out.getDate() + diff)
  out.setHours(0, 0, 0, 0)
  return out
}

export function endOfWeek(d: Date): Date {
  const start = startOfWeek(d)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0)
}

export function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999)
}

export function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

export function endOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(23, 59, 59, 999)
  return out
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())
}

export function addYears(d: Date, n: number): Date {
  return new Date(d.getFullYear() + n, d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())
}

export function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7)
}

export type RangeMode = 'week' | 'month' | 'year'

// Shift a date by N weeks/months/years (for the Browse prev/next buttons).
export function shiftRange(mode: RangeMode, anchor: Date, direction: -1 | 1): Date {
  if (mode === 'week') return addWeeks(anchor, direction)
  if (mode === 'month') return addMonths(anchor, direction)
  return addYears(anchor, direction)
}

export function rangeBounds(mode: RangeMode, anchor: Date): { start: Date; end: Date } {
  if (mode === 'week') return { start: startOfWeek(anchor), end: endOfWeek(anchor) }
  if (mode === 'month') return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
  return { start: startOfYear(anchor), end: endOfYear(anchor) }
}

export function rangeLabelFor(mode: RangeMode, anchor: Date): string {
  if (mode === 'week') {
    const s = startOfWeek(anchor)
    const e = endOfWeek(anchor)
    return `${prettyDate(s)} – ${prettyDate(e)}`
  }
  if (mode === 'month') {
    return `${shortMonthName(startOfMonth(anchor))} ${startOfMonth(anchor).getFullYear()}`
  }
  return `${startOfYear(anchor).getFullYear()}`
}

export function isRangeCurrent(mode: RangeMode, anchor: Date): boolean {
  const now = new Date()
  if (mode === 'week') return toKey(startOfWeek(anchor)) === toKey(startOfWeek(now))
  if (mode === 'month') {
    const a = startOfMonth(anchor)
    return a.getMonth() === now.getMonth() && a.getFullYear() === now.getFullYear()
  }
  return startOfYear(anchor).getFullYear() === now.getFullYear()
}

export function totalDaysInRange(mode: RangeMode, anchor: Date): number {
  if (mode === 'week') return 7
  if (mode === 'month') return endOfMonth(anchor).getDate()
  const year = startOfYear(anchor).getFullYear()
  return 365 + (isLeap(year) ? 1 : 0)
}

export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function shortDayName(d: Date): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
}

export function shortMonthName(d: Date): string {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]
}

export function prettyDate(d: Date): string {
  return `${shortMonthName(d)} ${d.getDate()}`
}

export function prettyDateWithYear(d: Date): string {
  return `${shortMonthName(d)} ${d.getDate()}, ${d.getFullYear()}`
}

// --- Quick ranges ---

export type QuickRangeId =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisWeek'
  | 'thisMonth'
  | 'thisYear'
  | 'all'

export const QUICK_RANGES: { id: QuickRangeId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'thisWeek', label: 'This week' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'thisYear', label: 'This year' },
  { id: 'all', label: 'All time' },
]

export function quickRange(id: QuickRangeId): { from: Date; to: Date } {
  const now = new Date()
  switch (id) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday': {
      const y = addDays(now, -1)
      return { from: startOfDay(y), to: endOfDay(y) }
    }
    case 'last7':
      return { from: startOfDay(addDays(now, -6)), to: endOfDay(now) }
    case 'last30':
      return { from: startOfDay(addDays(now, -29)), to: endOfDay(now) }
    case 'thisWeek':
      return { from: startOfWeek(now), to: endOfWeek(now) }
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfMonth(now) }
    case 'thisYear':
      return { from: startOfYear(now), to: endOfYear(now) }
    case 'all':
      return { from: new Date(2000, 0, 1), to: endOfDay(now) }
  }
}

export function rangeLabel(from: Date, to: Date): string {
  const fKey = toKey(from)
  const tKey = toKey(to)
  if (fKey === tKey) return prettyDateWithYear(from)
  if (from.getFullYear() === to.getFullYear()) {
    return `${prettyDate(from)} – ${prettyDate(to)}, ${from.getFullYear()}`
  }
  return `${prettyDateWithYear(from)} – ${prettyDateWithYear(to)}`
}

export function totalDays(from: Date, to: Date): number {
  const ms = endOfDay(to).getTime() - startOfDay(from).getTime()
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1)
}

// --- Buckets for arbitrary ranges ---

export interface Bucket {
  label: string
  startKey: string // YYYY-MM-DD inclusive
  endKey: string // YYYY-MM-DD inclusive
}

export function bucketsForRange(from: Date, to: Date, granularity: Granularity): Bucket[] {
  const result: Bucket[] = []
  if (granularity === 'day') {
    const cursor = startOfDay(from)
    while (cursor <= endOfDay(to)) {
      const key = toKey(cursor)
      result.push({
        label: shortDayName(cursor),
        startKey: key,
        endKey: key,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    return result
  }
  if (granularity === 'week') {
    let cursor = startOfWeek(from)
    while (cursor <= endOfDay(to)) {
      const ws = new Date(cursor)
      const we = endOfWeek(ws)
      const wkFrom = toKey(ws)
      const wkTo = toKey(we)
      result.push({
        label: `${prettyDate(ws)}`,
        startKey: wkFrom,
        endKey: wkTo,
      })
      cursor.setDate(cursor.getDate() + 7)
    }
    return result
  }
  if (granularity === 'month') {
    let cursor = startOfMonth(from)
    while (cursor <= endOfDay(to)) {
      const ms = new Date(cursor)
      const me = endOfMonth(ms)
      result.push({
        label: `${shortMonthName(ms)} ${ms.getFullYear()}`,
        startKey: toKey(ms),
        endKey: toKey(me),
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return result
  }
  // year
  let cursor = startOfYear(from)
  while (cursor <= endOfDay(to)) {
    const ys = new Date(cursor)
    const ye = endOfYear(ys)
    result.push({
      label: `${ys.getFullYear()}`,
      startKey: toKey(ys),
      endKey: toKey(ye),
    })
    cursor.setFullYear(cursor.getFullYear() + 1)
  }
  return result
}

// Default granularity for a given range span (used to seed the initial UI state
// and when the user picks a quick range — they can still change it manually).
export function defaultGranularityForRange(from: Date, to: Date): Granularity {
  const days = totalDays(from, to)
  if (days <= 31) return 'day'
  if (days <= 180) return 'week'
  if (days <= 730) return 'month'
  return 'year'
}

export function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

// --- Time helpers ---

// Format an ISO timestamp's time-of-day portion as HH:MM (24h).
export function timeOfDay(isoTimestamp: string): string {
  // Expecting "YYYY-MM-DDTHH:MM..." — slice 11..16.
  return isoTimestamp.slice(11, 16)
}

// Format an ISO timestamp as "Mon Sep 1, 14:30"
export function prettyTimestamp(isoTimestamp: string): string {
  const d = new Date(isoTimestamp)
  if (isNaN(d.getTime())) return isoTimestamp
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${shortDayName(d)} ${shortMonthName(d)} ${d.getDate()}, ${h}:${m}`
}
