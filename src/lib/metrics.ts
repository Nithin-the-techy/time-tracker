// Metrics model.
//
// A day has three layers:
//   Productive    — all department time except sleep
//   Neutral       — sleep (Health → Sleep entries + sleep neutral logs) plus
//                   other neutral logs (meals/hygiene/chores...) or the
//                   per-day pin from Settings
//   Negative      — explicitly logged harmful/avoidant time only.
//   Unknown       — elapsed time not yet accounted for. Unknown is evidence
//                   quality, never moral failure.
//
// NOTHING is assumed. A day with no logs is not a bad day — it is no data:
// zero sleep, zero neutral, zero unproductive, invisible to every chart.
// Sleep is a log, not a constant. Ranges and buckets are built ONLY from
// logged (active) days, so charts fill up as real data is added and future
// dates never render as failure. Per-day pins in Settings count as data for
// that day. Everything downstream reads the same numbers.
//
// GPP ($) = all-time productive minutes, averaged per tracked day, extended
// to a month, valued at a fixed $/h — computed once, shown identically in
// every view. Productive % = Productive / (1440 − Neutral) × 100, computed
// once per range from totals — never averaged across days.

import type { Entry, NeutralEntry, UnproductiveBlock } from './store'
import { browserTimeZone, dateKeyInTimeZone } from './dates'
import {
  GPP_DOLLARS_PER_HOUR,
  GPP_GOAL_DOLLARS,
  DEPARTMENT_COLORS,
  NEGATIVE_COLORS,
  NEUTRAL_COLORS,
  UNACCOUNTED_COLOR,
  NEUTRAL_DEFAULT_LABEL,
  NEGATIVE_ACTIVITIES,
  NEUTRAL_ACTIVITIES,
} from './constants'

const NEUTRAL_ACTIVITY_LIST = NEUTRAL_ACTIVITIES

// The API always nests department + subdepartment on every entry, so this is
// just Entry — kept as a named alias for readability at call sites.
export type EntryWithSub = Entry

// Per-day neutral overrides (see DayAllowance in the schema).
export interface AllowanceOverride {
  sleepMinutes: number | null // null = logged Sleep entry, else 8h default
  neutralMinutes: number | null // null = 90m eat/bathe default
}

export type AllowanceMap = Map<string, AllowanceOverride>

export function allowanceMap(
  list: { date: string; sleepMinutes: number | null; neutralMinutes: number | null }[],
): AllowanceMap {
  return new Map(list.map((a) => [a.date, { sleepMinutes: a.sleepMinutes, neutralMinutes: a.neutralMinutes }]))
}

// Neutral logs carry only a date (no time-of-day needed for the math).
export interface NeutralEntryLike extends Omit<NeutralEntry, 'createdAt'> {
  createdAt?: string
}

export interface NegativeBlockLike extends Omit<UnproductiveBlock, 'createdAt'> {
  createdAt?: string
}

export interface DayMetrics {
  date: string // YYYY-MM-DD
  active: boolean // has at least one log (entry, neutral log, or pinned day)
  productive: number
  neutral: number
  sleepMinutes: number // logged (or pinned) only — never assumed
  mealsMinutes: number // logged (or pinned) only — never assumed
  available: number // 1440 − sleep − meals (logged days only)
  gpp: number
  unproductive: number
  unknown: number
  productivePercent: number | null // null if available ≤ 0
}

export interface RangeMetrics {
  productive: number
  neutral: number
  sleepMinutes: number
  available: number
  gpp: number
  unproductive: number
  unknown: number
  productivePercent: number | null
  totalDays: number
  activeDays: number // days with at least one non-sleep entry
}

export interface DepartmentShare {
  departmentId: string
  departmentName: string
  slug: string
  minutes: number
  gppContribution: number
  shareOfGpp: number // percent
  daysActive: number
  entryCount: number
  sortOrder: number
}

export interface SubdepartmentShare {
  subdepartmentId: string
  subdepartmentName: string
  departmentId: string
  minutes: number
  gppContribution: number
  shareOfDeptGpp: number
  entryCount: number
  weight: number
}

// One bucket (day/week/month/year) for bar charts.
export interface BucketDatum {
  label: string
  startKey: string
  endKey: string
  productive: number
  unproductive: number
  unknown: number
  neutral: number
  hasEntries: boolean
  productivePercent: number | null
}

export function entryDateKey(e: { entryTimestamp: string }): string {
  return dateKeyInTimeZone(e.entryTimestamp, browserTimeZone())
}

export function entryTimeKey(e: { entryTimestamp: string }): string {
  const date = new Date(e.entryTimestamp)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: browserTimeZone(), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}

// Sleep = Health → Sleep department entries + neutral logs labeled 'sleep'.
// Renaming that sub-department breaks the baseline.
export function isSleepEntry(e: EntryWithSub): boolean {
  return e.department.slug === 'health' && e.subdepartment?.name === 'Sleep'
}

function loggedSleepMinutes(
  entries: EntryWithSub[],
  neutralEntries: NeutralEntryLike[],
  dateKey: string,
): number {
  const fromEntries = entries
    .filter((e) => entryDateKey(e) === dateKey && isSleepEntry(e))
    .reduce((acc, e) => acc + e.durationMinutes, 0)
  const fromNeutral = neutralEntries
    .filter((n) => n.date === dateKey && n.activity === 'sleep')
    .reduce((acc, n) => acc + n.minutes, 0)
  return fromEntries + fromNeutral
}

function loggedOtherNeutralMinutes(neutralEntries: NeutralEntryLike[], dateKey: string): number {
  return neutralEntries
    .filter((n) => n.date === dateKey && n.activity !== 'sleep')
    .reduce((acc, n) => acc + n.minutes, 0)
}

export function dayMetrics(
  entries: EntryWithSub[],
  dateKey: string,
  allowances?: AllowanceMap,
  neutralEntries: NeutralEntryLike[] = [],
  negativeBlocks: NegativeBlockLike[] = [],
  now: Date = new Date(),
): DayMetrics {
  const dayEntries = entries.filter((e) => entryDateKey(e) === dateKey)
  const override = allowances?.get(dateKey)

  // Sleep: pin > logged (Sleep entries + sleep neutral logs). No log, no
  // number — sleep is data, never an assumption.
  const loggedSleep = loggedSleepMinutes(entries, neutralEntries, dateKey)
  const sleepMinutes = override?.sleepMinutes != null ? override.sleepMinutes : loggedSleep

  // Other neutral: pin > logged (meals, chores...). No default.
  const loggedOther = loggedOtherNeutralMinutes(neutralEntries, dateKey)
  const mealsMinutes = override?.neutralMinutes != null ? override.neutralMinutes : loggedOther

  // A day exists to the app only if something was actually logged on it —
  // any department entry, any neutral log, or a pinned sleep/neutral value.
  const explicitNegative = negativeBlocks
    .filter((block) => block.date === dateKey)
    .reduce((sum, block) => sum + block.minutes, 0)
  const active = dayEntries.length > 0 || loggedSleep > 0 || loggedOther > 0 || explicitNegative > 0 || override != null

  if (!active) {
    return {
      date: dateKey,
      active: false,
      productive: 0,
      neutral: 0,
      sleepMinutes: 0,
      mealsMinutes: 0,
      available: 0,
      gpp: 0,
      unproductive: 0,
      unknown: 0,
      productivePercent: null,
    }
  }

  const neutral = sleepMinutes + mealsMinutes
  const todayKey = toDateKeyLocal(now)
  const observedMinutes = dateKey < todayKey
    ? 1440
    : dateKey === todayKey
      ? now.getHours() * 60 + now.getMinutes()
      : 0
  const available = Math.max(0, observedMinutes - neutral)

  let productive = 0
  for (const e of dayEntries) {
    if (isSleepEntry(e)) continue
    productive += e.durationMinutes
  }

  const unproductive = explicitNegative
  const unknown = Math.max(0, observedMinutes - neutral - productive - explicitNegative)
  const productivePercent = available > 0 ? (productive / available) * 100 : null

  return {
    date: dateKey,
    active: true,
    productive,
    neutral,
    sleepMinutes,
    mealsMinutes,
    available,
    gpp: productive,
    unproductive,
    unknown,
    productivePercent,
  }
}

export function dateKeysInRange(fromKey: string, toKey: string): string[] {
  const keys: string[] = []
  const [fromYear, fromMonth, fromDay] = fromKey.split('-').map(Number)
  const [toYear, toMonth, toDay] = toKey.split('-').map(Number)
  const cursor = new Date(fromYear, fromMonth - 1, fromDay)
  const end = new Date(toYear, toMonth - 1, toDay)
  while (cursor.getTime() <= end.getTime()) {
    keys.push(toDateKeyLocal(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

export function rangeMetrics(
  entries: EntryWithSub[],
  startDateKey: string,
  endDateKey: string,
  allowances?: AllowanceMap,
  neutralEntries: NeutralEntryLike[] = [],
  negativeBlocks: NegativeBlockLike[] = [],
  now: Date = new Date(),
): RangeMetrics {
  const days = dateKeysInRange(startDateKey, endDateKey)

  let productive = 0
  let neutral = 0
  let sleepTotal = 0
  let availableSum = 0
  let activeDays = 0
  let explicitNegative = 0
  let unknown = 0

  for (const day of days) {
    const m = dayMetrics(entries, day, allowances, neutralEntries, negativeBlocks, now)
    if (!m.active) continue // unlogged days are no data, not a bad day
    productive += m.productive
    neutral += m.neutral
    sleepTotal += m.sleepMinutes
    availableSum += m.available
    activeDays += 1
    explicitNegative += m.unproductive
    unknown += m.unknown
  }

  const available = availableSum
  const unproductive = explicitNegative
  const productivePercent = available > 0 ? (productive / available) * 100 : null

  return {
    productive,
    neutral,
    sleepMinutes: sleepTotal,
    available,
    gpp: productive,
    unproductive,
    unknown,
    productivePercent,
    totalDays: days.length,
    activeDays,
  }
}

// Per-bucket totals for charts. Sleep is resolved per real day (not a flat
// default), so buckets with partial logs stay accurate.
export function bucketSeries(
  entries: EntryWithSub[],
  buckets: { label: string; startKey: string; endKey: string }[],
  allowances?: AllowanceMap,
  neutralEntries: NeutralEntryLike[] = [],
  negativeBlocks: NegativeBlockLike[] = [],
  now: Date = new Date(),
): BucketDatum[] {
  return buckets.map((b) => {
    const days = dateKeysInRange(b.startKey, b.endKey)
    let productive = 0
    let neutral = 0
    let availableSum = 0
    let hasEntries = false
    let explicitNegative = 0
    let unknown = 0

    for (const day of days) {
      const m = dayMetrics(entries, day, allowances, neutralEntries, negativeBlocks, now)
      if (!m.active) continue // only logged days render — bars fill up as you log
      productive += m.productive
      neutral += m.neutral
      availableSum += m.available
      if (m.productive > 0) hasEntries = true
      if (m.unproductive > 0 || m.neutral > 0 || m.unknown > 0) hasEntries = true
      explicitNegative += m.unproductive
      unknown += m.unknown
    }

    const available = availableSum
    const unproductive = explicitNegative
    const productivePercent = available > 0 ? (productive / available) * 100 : null

    return {
      label: b.label,
      startKey: b.startKey,
      endKey: b.endKey,
      productive,
      unproductive,
      unknown,
      neutral,
      hasEntries,
      productivePercent,
    }
  })
}

export function departmentShares(
  entries: EntryWithSub[],
): DepartmentShare[] {
  const byDept = new Map<
    string,
    {
      departmentId: string
      departmentName: string
      slug: string
      sortOrder: number
      minutes: number
      gppContribution: number
      entryCount: number
      daysSet: Set<string>
    }
  >()
  for (const e of entries) {
    const k = e.departmentId
    if (!byDept.has(k)) {
      byDept.set(k, {
        departmentId: e.departmentId,
        departmentName: e.department.name,
        slug: e.department.slug,
        sortOrder: e.department.sortOrder,
        minutes: 0,
        gppContribution: 0,
        entryCount: 0,
        daysSet: new Set(),
      })
    }
    const rec = byDept.get(k)!
    rec.minutes += e.durationMinutes
    rec.gppContribution += e.durationMinutes
    rec.entryCount += 1
    rec.daysSet.add(entryDateKey(e))
  }
  const totalMinutes = Array.from(byDept.values()).reduce((a, x) => a + x.minutes, 0)
  return Array.from(byDept.values())
    .map((r) => ({
      departmentId: r.departmentId,
      departmentName: r.departmentName,
      slug: r.slug,
      minutes: r.minutes,
      gppContribution: r.minutes,
      shareOfGpp: totalMinutes > 0 ? (r.minutes / totalMinutes) * 100 : 0,
      daysActive: r.daysSet.size,
      entryCount: r.entryCount,
      sortOrder: r.sortOrder,
    }))
    .sort((a, b) => b.minutes - a.minutes)
}

export function subdepartmentShares(
  entries: EntryWithSub[],
  departmentId: string,
): SubdepartmentShare[] {
  const filtered = entries.filter((e) => e.departmentId === departmentId)
  const bySub = new Map<
    string,
    { subdepartmentId: string; subdepartmentName: string; minutes: number; gppContribution: number; entryCount: number; weight: number }
  >()
  let totalDeptGpp = 0
  for (const e of filtered) {
    const weight = e.subdepartment?.valueWeight ?? 1.0
    totalDeptGpp += e.durationMinutes * weight
    const k = e.subdepartmentId ?? '__area_only__'
    if (!bySub.has(k)) {
      bySub.set(k, {
        subdepartmentId: e.subdepartmentId ?? '__area_only__',
        subdepartmentName: e.subdepartment?.name ?? 'Area only',
        minutes: 0,
        gppContribution: 0,
        entryCount: 0,
        weight,
      })
    }
    const rec = bySub.get(k)!
    rec.minutes += e.durationMinutes
    rec.gppContribution += e.durationMinutes * weight
    rec.entryCount += 1
  }
  return Array.from(bySub.values())
    .map((r) => ({
      subdepartmentId: r.subdepartmentId,
      subdepartmentName: r.subdepartmentName,
      departmentId,
      minutes: r.minutes,
      gppContribution: r.gppContribution,
      shareOfDeptGpp: totalDeptGpp > 0 ? (r.gppContribution / totalDeptGpp) * 100 : 0,
      entryCount: r.entryCount,
      weight: r.weight,
    }))
    .sort((a, b) => b.gppContribution - a.gppContribution)
}

// --- Today pace projection ---

export interface DayProjection {
  productive: number // projected end-of-day minutes
  unknown: number // unallocated by the current productive logging pace, not predicted moral failure
  elapsedShare: number // 0..1
}

export function projectDay(m: DayMetrics, nowMinutes: number): DayProjection | null {
  if (!m.active || m.available <= 0) return null
  const elapsedOpen = Math.min(Math.max(nowMinutes - m.sleepMinutes, 0), m.available)
  const share = elapsedOpen / m.available
  // Too early to say anything, or the day is effectively done.
  if (share < 0.05 || share > 0.95) return null
  if (m.productive <= 0) return null
  const productive = Math.min(m.available, m.productive / share)
  const unknown = Math.max(0, m.available - productive)
  return { productive, unknown, elapsedShare: share }
}

// --- GPP: the one number, computed once, same everywhere ---
//
// Like nominal GDP: all output over the whole tracked history, valued at one
// current price (GPP_DOLLARS_PER_HOUR per productive hour). Every productive
// minute ever logged is summed, averaged over the days you've been tracking
// (first log through today — skipped days count), then extended to a month.
//
// It deliberately does NOT depend on the Day+Week / Month / Year switch:
// one formula, one input (all your data), so the same number shows in every
// view. Log more (and show up daily) and it rises.

const DAYS_PER_MONTH = 30

export interface GppStats {
  totalProductiveMinutes: number // every productive minute ever logged
  daysTracked: number // first log → today, inclusive
  avgPerDayMinutes: number
  monthlyDollars: number // avg/day × 30 × $/h
  monthlyHours: number // avg/day × 30
  annualDollars: number // monthly × 12 — the long-run pace line
  goalPercent: number // monthly GPP vs the $1T/month goal
}

export function gppStats(allEntries: EntryWithSub[], today: Date = new Date()): GppStats {
  let totalProductiveMinutes = 0
  let firstKey: string | null = null
  const todayKey = toDateKeyLocal(today)

  for (const e of allEntries) {
    if (isSleepEntry(e)) continue
    totalProductiveMinutes += e.durationMinutes
    const k = entryDateKey(e)
    if (firstKey === null || k < firstKey) firstKey = k
  }

  // Days from the first log through today. Nothing logged yet → count today
  // so the number simply reads $0 instead of NaN.
  const daysTracked =
    firstKey === null
      ? 1
      : Math.max(
          1,
          Math.round(
            (new Date(todayKey + 'T00:00:00').getTime() - new Date(firstKey + 'T00:00:00').getTime()) /
              (24 * 60 * 60 * 1000),
          ) + 1,
        )

  const avgPerDayMinutes = totalProductiveMinutes / daysTracked
  const monthlyDollars = (avgPerDayMinutes / 60) * DAYS_PER_MONTH * GPP_DOLLARS_PER_HOUR
  const annualDollars = monthlyDollars * 12

  return {
    totalProductiveMinutes,
    daysTracked,
    avgPerDayMinutes,
    monthlyDollars,
    monthlyHours: (avgPerDayMinutes / 60) * DAYS_PER_MONTH,
    annualDollars,
    goalPercent: (monthlyDollars / GPP_GOAL_DOLLARS) * 100,
  }
}

// The right-hand headline stat: productive hours across the trailing 30 days
// (clamped to when tracking started, so a fresh log isn't read as "across 30
// days" on day 3). Window-span independent — same number in every view.
export interface TrailingStats {
  productiveMinutes: number
  days: number // actual span, ≤ 30
  hoursPerDay: number
  fromKey: string
  toKey: string
}

export function trailingProductive(allEntries: EntryWithSub[], windowDays = 30, today: Date = new Date()): TrailingStats {
  const todayKey = toDateKeyLocal(today)
  let firstKey: string | null = null
  for (const e of allEntries) {
    const k = entryDateKey(e)
    if (firstKey === null || k < firstKey) firstKey = k
  }

  const rawFrom = new Date(today.getTime() - (windowDays - 1) * 24 * 60 * 60 * 1000)
  const fromKey = firstKey !== null && firstKey > toDateKeyLocal(rawFrom) ? firstKey : toDateKeyLocal(rawFrom)
  const days = Math.max(
    1,
    Math.round(
      (new Date(todayKey + 'T00:00:00').getTime() - new Date(fromKey + 'T00:00:00').getTime()) / (24 * 60 * 60 * 1000),
    ) + 1,
  )

  let productiveMinutes = 0
  for (const e of allEntries) {
    if (isSleepEntry(e)) continue
    const k = entryDateKey(e)
    if (k >= fromKey && k <= todayKey) productiveMinutes += e.durationMinutes
  }

  return {
    productiveMinutes,
    days,
    hoursPerDay: productiveMinutes / 60 / days,
    fromKey,
    toKey: todayKey,
  }
}

// % of the $1T/month goal a monthly-dollar figure represents.
export function gppGoalPercent(dollars: number): number {
  return (dollars / GPP_GOAL_DOLLARS) * 100
}

// $32.4k · $1.2M · $184B · $1.0T
export function formatMoney(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(v >= 1e13 ? 0 : 1)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(v >= 1e10 ? 0 : 1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k`
  return `$${Math.round(v)}`
}

// "0.0000032% of the $1T goal" — keeps tiny fractions readable (1 sig fig).
export function formatGoalPercent(p: number): string {
  if (p <= 0) return '0%'
  if (p >= 0.01) return `${p.toFixed(2)}%`
  if (p >= 0.0001) return `${p.toFixed(4)}%`
  const decimals = Math.min(12, -Math.floor(Math.log10(p)) + 1)
  return `${p.toFixed(decimals)}%`
}

// --- Full composition (for the unified donut) ---
//
// One flat list of slices covering the whole window, grouped by kind:
//   productive  → one slice per department (own colors, clickable)
//   neutral     → Sleep + per-activity neutral logs + assumed baseline lump
//   negative    → tagged activities + Unaccounted (the derived remainder)
// Slice minutes always sum to 24h × days — the honest "where did time go".

export type SliceKind = 'productive' | 'neutral' | 'negative' | 'unknown'

export interface CompositionSlice {
  key: string
  label: string
  minutes: number
  kind: SliceKind
  color: string
  slug?: string // department slug — donut legend rows open the dept page
  unaccounted?: boolean
}

function prettifyTag(tag: string): string {
  const known = NEGATIVE_ACTIVITIES.find((t) => t.id === tag)
  if (known) return known.label
  return tag.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export function compositionForRange(
  entries: EntryWithSub[],
  blocks: NegativeBlockLike[],
  startDateKey: string,
  endDateKey: string,
  allowances?: AllowanceMap,
  neutralEntries: NeutralEntryLike[] = [],
): { slices: CompositionSlice[]; totals: RangeMetrics } {
  const inRange = (k: string) => k >= startDateKey && k <= endDateKey
  const windowEntries = entries.filter((e) => inRange(entryDateKey(e)))
  const windowNeutral = neutralEntries.filter((n) => inRange(n.date))
  const windowBlocks = blocks.filter((b) => inRange(b.date))
  const days = dateKeysInRange(startDateKey, endDateKey)
  const totals = rangeMetrics(entries, startDateKey, endDateKey, allowances, neutralEntries, blocks)

  const slices: CompositionSlice[] = []
  // Donut covers logged days only — unlogged days contribute nothing at all.

  // Productive: per department, plain hours, biggest first.
  for (const d of departmentShares(windowEntries.filter((e) => !isSleepEntry(e)))) {
    slices.push({
      key: `dept-${d.slug}`,
      label: d.departmentName.replace('Department of ', ''),
      minutes: d.minutes,
      kind: 'productive',
      color: DEPARTMENT_COLORS[d.slug] ?? '#38bdf8',
      slug: d.slug,
    })
  }

  // Neutral: sleep + per-activity logs, then whatever a Settings pin still
  // covers. Only logged days are touched — no assumed sleep, no lump for
  // silent days.
  let sleepTotal = 0
  let mealsTotal = 0
  for (const day of days) {
    const m = dayMetrics(entries, day, allowances, neutralEntries, blocks)
    if (!m.active) continue
    sleepTotal += m.sleepMinutes
    mealsTotal += m.mealsMinutes
  }
  slices.push({ key: 'neutral-sleep', label: 'Sleep', minutes: sleepTotal, kind: 'neutral', color: NEUTRAL_COLORS[0] })

  const byActivity = new Map<string, number>()
  for (const n of windowNeutral) {
    if (n.activity === 'sleep') continue
    byActivity.set(n.activity, (byActivity.get(n.activity) ?? 0) + n.minutes)
  }
  const hasActiveDays = totals.activeDays > 0
  const loggedOtherTotal = Array.from(byActivity.values()).reduce((a, b) => a + b, 0)
  const knownNeutral = new Map(NEUTRAL_ACTIVITY_LIST.map((a) => [a.id, a.label]))
  const activityRows = Array.from(byActivity.entries())
    .map(([id, minutes], i) => ({
      key: `neutral-${id}`,
      label: knownNeutral.get(id) ?? id.replace(/^\w/, (c) => c.toUpperCase()),
      minutes,
      kind: 'neutral' as const,
      color: NEUTRAL_COLORS[(i + 1) % NEUTRAL_COLORS.length],
    }))
    .sort((a, b) => b.minutes - a.minutes)

  // The assumed baseline lump only counts where no logs replaced it. If logs
  // somehow exceed the assumed total, scale the log slices down so the pie
  // still sums to exactly 24h × days.
  const lump = Math.max(0, mealsTotal - loggedOtherTotal)
  const scale = loggedOtherTotal > mealsTotal && loggedOtherTotal > 0 ? mealsTotal / loggedOtherTotal : 1
  for (const r of activityRows) {
    slices.push({ ...r, minutes: Math.round(r.minutes * scale) })
  }
  if (lump > 0) {
    slices.push({
      key: 'neutral-default',
      label: NEUTRAL_DEFAULT_LABEL,
      minutes: lump,
      kind: 'neutral',
      color: NEUTRAL_COLORS[1],
    })
  }

  // Negative: per tagged activity, then the unaccounted remainder.
  const byTag = new Map<string, number>()
  for (const b of windowBlocks) {
    byTag.set(b.tag, (byTag.get(b.tag) ?? 0) + b.minutes)
  }
  let taggedTotal = 0
  const tagRows = Array.from(byTag.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag, minutes], i) => {
      taggedTotal += minutes
      return {
        key: `neg-${tag}`,
        label: prettifyTag(tag),
        minutes,
        kind: 'negative' as const,
        color: NEGATIVE_COLORS[i % NEGATIVE_COLORS.length],
      }
    })
  slices.push(...tagRows)

  const unlabeledNegative = Math.max(0, totals.unproductive - taggedTotal)
  if (unlabeledNegative > 0) {
    slices.push({
      key: 'neg-unaccounted',
      label: 'Unlabelled negative',
      minutes: unlabeledNegative,
      kind: 'negative',
      color: UNACCOUNTED_COLOR,
      unaccounted: true,
    })
  }

  if (totals.unknown > 0) {
    slices.push({
      key: 'unknown',
      label: 'Unlogged',
      minutes: totals.unknown,
      kind: 'unknown',
      color: '#475569',
      unaccounted: true,
    })
  }

  // A range nobody logged shows as genuinely empty — the donut renders its
  // blank state instead of pretending a full day happened.
  return { slices: hasActiveDays ? slices.filter((s) => s.minutes > 0) : [], totals }
}

// "today" · "3d ago" · "2w ago" · "4mo ago" — for the Database index.
export function lastActiveLabel(entries: EntryWithSub[], departmentId: string, today: Date = new Date()): string {
  let latest: string | null = null
  for (const e of entries) {
    if (e.departmentId !== departmentId) continue
    const k = entryDateKey(e)
    if (latest === null || k > latest) latest = k
  }
  if (latest === null) return 'never'
  const todayKey = toDateKeyLocal(today)
  if (latest === todayKey) return 'today'
  const diffDays = Math.round(
    (new Date(todayKey + 'T00:00:00').getTime() - new Date(latest + 'T00:00:00').getTime()) / (24 * 60 * 60 * 1000),
  )
  if (diffDays < 14) return `${diffDays}d ago`
  if (diffDays < 60) return `${Math.round(diffDays / 7)}w ago`
  return `${Math.round(diffDays / 30)}mo ago`
}

// Streaks — consecutive days with ≥1 entry in a department. Current streak
// counts back from today (or yesterday, so an unfinished today doesn't break it).
export interface Streaks {
  current: number
  best: number
  live: boolean
}

export function departmentStreaks(
  entries: EntryWithSub[],
  departmentId: string,
  today: Date = new Date(),
): Streaks {
  const daySet = new Set<string>()
  for (const e of entries) {
    if (e.departmentId === departmentId) {
      daySet.add(entryDateKey(e))
    }
  }
  if (daySet.size === 0) return { current: 0, best: 0, live: false }

  const sortedDays = Array.from(daySet).sort()
  const todayKey = toDateKeyLocal(today)
  const yesterdayKey = toDateKeyLocal(new Date(today.getTime() - 24 * 60 * 60 * 1000))

  let current = 0
  const live = daySet.has(todayKey)
  const cursorStart = live ? todayKey : yesterdayKey
  if (daySet.has(cursorStart)) {
    let cursor = new Date(cursorStart + 'T00:00:00')
    while (daySet.has(toDateKeyLocal(cursor))) {
      current += 1
      cursor.setDate(cursor.getDate() - 1)
    }
  }

  let best = 0
  let run = 0
  let prev: string | null = null
  for (const day of sortedDays) {
    if (prev === null) {
      run = 1
    } else {
      const prevDate = new Date(prev + 'T00:00:00')
      const curDate = new Date(day + 'T00:00:00')
      const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000))
      run = diffDays === 1 ? run + 1 : 1
    }
    if (run > best) best = run
    prev = day
  }

  return { current, best, live }
}

// --- Formatters ---

export function formatHours(minutes: number): string {
  const h = minutes / 60
  if (h < 0.1) return `${Math.round(minutes)}m`
  if (h < 10) return `${h.toFixed(1)}h`
  return `${Math.round(h)}h`
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatPercent(percent: number | null): string {
  if (percent === null) return '—'
  return `${Math.round(percent)}%`
}

export function formatSignedDelta(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  const abs = Math.abs(value)
  const h = abs / 60
  if (h < 0.1) return `${sign}${Math.round(abs)}m`
  if (h < 10) return `${sign}${h.toFixed(1)}h`
  return `${sign}${Math.round(h)}h`
}

function toDateKeyLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
