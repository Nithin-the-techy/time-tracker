import test from 'node:test'
import assert from 'node:assert/strict'
import { dateKeysInRange, dayMetrics, rangeMetrics, type EntryWithSub } from '../src/lib/metrics'
import { goalProgressInfo } from '../src/lib/goal-metrics'
import type { Goal } from '../src/lib/store'
import { dateKeyInTimeZone, utcBoundsForDateRange } from '../src/lib/dates'
import { sessionFinishState, type SessionDisposition } from '../src/lib/session-state'

function entry(date: string, minutes: number, sleep = false): EntryWithSub {
  return {
    id: `${date}-${minutes}-${sleep}`,
    departmentId: sleep ? 'health' : 'education',
    subdepartmentId: sleep ? 'sleep' : 'physics',
    entryTimestamp: `${date}T08:00:00.000Z`,
    durationMinutes: minutes,
    note: null,
    obsidianRef: null,
    createdAt: `${date}T08:00:00.000Z`,
    department: { id: sleep ? 'health' : 'education', name: sleep ? 'Health' : 'Education', slug: sleep ? 'health' : 'education', sortOrder: 1, subType: 'freeform', moduleKey: sleep ? 'generic' : 'education' },
    subdepartment: { id: sleep ? 'sleep' : 'physics', name: sleep ? 'Sleep' : 'Physics', valueWeight: 1 },
  }
}

test('current day counts elapsed time and separates unknown from negative', () => {
  const now = new Date(2026, 8, 6, 12, 0, 0)
  const metrics = dayMetrics(
    [entry('2026-09-06', 480, true), entry('2026-09-06', 60)],
    '2026-09-06',
    undefined,
    [],
    [{ id: 'negative', date: '2026-09-06', tag: 'scrolling', minutes: 30, note: null }],
    now,
  )
  assert.equal(metrics.available, 240)
  assert.equal(metrics.productive, 60)
  assert.equal(metrics.unproductive, 30)
  assert.equal(metrics.unknown, 150)
  assert.equal(metrics.productivePercent, 25)
})

test('a silent day is no data, not failure', () => {
  const metrics = dayMetrics([], '2026-09-05', undefined, [], [], new Date(2026, 8, 6, 12))
  assert.equal(metrics.active, false)
  assert.equal(metrics.unproductive, 0)
  assert.equal(metrics.unknown, 0)
})

test('calendar iteration preserves date keys without UTC round trips', () => {
  assert.deepEqual(dateKeysInRange('2026-09-29', '2026-10-02'), ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
})

test('ranges sum explicit negative and unknown independently', () => {
  const metrics = rangeMetrics(
    [entry('2026-09-05', 120)],
    '2026-09-05',
    '2026-09-05',
    undefined,
    [],
    [{ id: 'negative', date: '2026-09-05', tag: 'gaming', minutes: 60, note: null }],
    new Date(2026, 8, 6, 12),
  )
  assert.equal(metrics.productive, 120)
  assert.equal(metrics.unproductive, 60)
  assert.equal(metrics.unknown, 1260)
})

test('explicit Outcome Measures stay truthful when backlog Steps are added', () => {
  const goal = {
    targets: [{ targetValue: 10, currentValue: 5, weight: 1 }],
    actions: [{ status: 'completed' }],
  } as unknown as Goal
  const before = goalProgressInfo(goal)
  goal.actions.push({ status: 'backlog' } as never)
  const after = goalProgressInfo(goal)
  assert.equal(before.ratio, 0.5)
  assert.equal(after.ratio, 0.5)
})

test('an Outcome without Measures uses a Step count or an honest empty state', () => {
  const empty = goalProgressInfo({ targets: [], actions: [] } as unknown as Goal)
  const withSteps = goalProgressInfo({ targets: [], actions: [{ status: 'completed' }, { status: 'today' }] } as unknown as Goal)
  assert.equal(empty.label, 'No progress measure yet')
  assert.equal(withSteps.label, '1 of 2 Steps done')
  assert.equal(withSteps.ratio, null)
})

test('workspace timezone owns calendar boundaries, including DST days', () => {
  assert.equal(dateKeyInTimeZone('2026-09-07T18:29:59.999Z', 'Asia/Kolkata'), '2026-09-07')
  assert.equal(dateKeyInTimeZone('2026-09-07T18:30:00.000Z', 'Asia/Kolkata'), '2026-09-08')
  const dst = utcBoundsForDateRange('2026-03-08', '2026-03-08', 'America/New_York')
  assert.equal(dst.start.toISOString(), '2026-03-08T05:00:00.000Z')
  assert.equal(dst.end.toISOString(), '2026-03-09T03:59:59.999Z')
})

test('every Session disposition creates an Entry and maps Step state explicitly', () => {
  const cases: Array<[SessionDisposition, 'completed' | 'interrupted', 'completed' | 'today' | 'backlog', boolean]> = [
    ['complete_step', 'completed', 'completed', true],
    ['stop_keep_today', 'interrupted', 'today', false],
    ['stop_to_backlog', 'interrupted', 'backlog', true],
    ['interrupted_keep_today', 'interrupted', 'today', false],
    ['interrupted_to_backlog', 'interrupted', 'backlog', true],
  ]
  for (const [disposition, sessionStatus, actionStatus, clearsTodayOrder] of cases) {
    assert.deepEqual(sessionFinishState(disposition), { sessionStatus, actionStatus, clearsTodayOrder, createsEntry: true })
  }
})

