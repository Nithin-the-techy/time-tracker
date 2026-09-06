// UI state for the app shell: tabs, department routing, log modal, ranges.
import { create } from 'zustand'
import {
  quickRange,
  defaultGranularityForRange,
  type Granularity,
} from '@/lib/dates'

// progress — combined day + week view, month/year modes, standings
// database — departments and raw range browsing (no motivation, just data)
// settings — weights, rivals, backups
export type ScreenTab = 'today' | 'goals' | 'progress' | 'database' | 'settings'

// Which window the Progress tab shows. 'dayweek' combines the current day
// with the rolling last-7-days; month/year are rolling 30/365-day windows.
export type ProgressMode = 'dayweek' | 'month' | 'year'

interface UIState {
  tab: ScreenTab
  setTab: (t: ScreenTab) => void

  progressMode: ProgressMode
  setProgressMode: (m: ProgressMode) => void

  activeDeptSlug: string | null
  openDeptPage: (slug: string) => void
  closeDeptPage: () => void

  activeGoalId: string | null
  openGoal: (id: string) => void
  closeGoal: () => void

  logModalOpen: boolean
  logModalPresetDept: string | null
  openLogModal: (presetDeptSlug?: string) => void
  closeLogModal: () => void

  // Database tab browse range.
  browseFrom: string
  browseTo: string
  browseGranularity: Granularity
  setBrowseRange: (from: string, to: string) => void
  setBrowseGranularity: (g: Granularity) => void

  // Department-page range (independent of browse).
  deptFrom: string
  deptTo: string
  deptGranularity: Granularity
  setDeptRange: (from: string, to: string) => void
  setDeptGranularity: (g: Granularity) => void

  browseDeptFilter: string | null
  setBrowseDeptFilter: (id: string | null) => void
}

function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const initial = quickRange('last7')
const initFromKey = toKey(initial.from)
const initToKey = toKey(initial.to)

function defaultGranForRange(from: string, to: string): Granularity {
  return defaultGranularityForRange(
    new Date(from + 'T00:00:00'),
    new Date(to + 'T23:59:59'),
  )
}

export const useUIStore = create<UIState>((set) => ({
  tab: 'today',
  setTab: (t) => set({ tab: t, activeDeptSlug: null, activeGoalId: null }),

  progressMode: 'dayweek',
  setProgressMode: (m) => set({ progressMode: m }),

  activeDeptSlug: null,
  openDeptPage: (slug) => set({
    tab: 'database',
    activeDeptSlug: slug,
    deptFrom: initFromKey,
    deptTo: initToKey,
    deptGranularity: 'day',
  }),
  closeDeptPage: () => set({ activeDeptSlug: null }),

  activeGoalId: null,
  openGoal: (id) => set({ tab: 'goals', activeGoalId: id }),
  closeGoal: () => set({ activeGoalId: null }),

  logModalOpen: false,
  logModalPresetDept: null,
  openLogModal: (presetDeptSlug) => set({
    logModalOpen: true,
    logModalPresetDept: presetDeptSlug ?? null,
  }),
  closeLogModal: () => set({ logModalOpen: false, logModalPresetDept: null }),

  browseFrom: initFromKey,
  browseTo: initToKey,
  browseGranularity: 'day',
  setBrowseRange: (from, to) => set({
    browseFrom: from,
    browseTo: to,
    browseGranularity: defaultGranForRange(from, to),
  }),
  setBrowseGranularity: (g) => set({ browseGranularity: g }),

  deptFrom: initFromKey,
  deptTo: initToKey,
  deptGranularity: 'day',
  setDeptRange: (from, to) => set({
    deptFrom: from,
    deptTo: to,
    deptGranularity: defaultGranForRange(from, to),
  }),
  setDeptGranularity: (g) => set({ deptGranularity: g }),

  browseDeptFilter: null,
  setBrowseDeptFilter: (id) => set({ browseDeptFilter: id }),
}))
