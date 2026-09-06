'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { store, type AppState } from '@/lib/store'

// Re-export the model types — components import them from here.
export type { Entry, Department, Subdepartment, DayAllowance, NeutralEntry, UnproductiveBlock, Goal, GoalTarget, GoalProblem, GoalAction, FocusSession, Sprint, SprintGoal } from '@/lib/store'

export function useBootstrap() {
  useEffect(() => {
    store.bootstrap().catch(console.error)
  }, [])
}

function useStoreSlice<T>(selector: (s: Partial<AppState>) => T | undefined): T | undefined {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getCache()),
    () => selector(store.getCache()),
  )
}

export function useDepartments() {
  const depts = useStoreSlice((s) => s.departments)
  return { departments: depts ?? [], loading: !depts }
}

export function useAllEntries(): { entries: AppState['entries'] } {
  const entries = useStoreSlice((s) => s.entries)
  return { entries: entries ?? [] }
}

export function useWeightChanges() {
  const changes = useStoreSlice((s) => s.weightChanges)
  return { changes: changes ?? [] }
}

export function useRivals() {
  const rivals = useStoreSlice((s) => s.rivals)
  return { rivals: rivals ?? [] }
}

export function useUnproductiveBlocks() {
  const blocks = useStoreSlice((s) => s.unproductiveBlocks)
  return { blocks: blocks ?? [] }
}

export function useNeutralEntries() {
  const entries = useStoreSlice((s) => s.neutralEntries)
  return { neutralEntries: entries ?? [] }
}

export function useAllowances() {
  const allowances = useStoreSlice((s) => s.allowances)
  return { allowances: allowances ?? [] }
}

export function useGoals() {
  const goals = useStoreSlice((s) => s.goals)
  return { goals: goals ?? [], loading: !goals }
}

export function useSprints() {
  const sprints = useStoreSlice((s) => s.sprints)
  return { sprints: sprints ?? [], loading: !sprints }
}

// Range-bounded view. Serves from cache and refreshes in the background.
export function useEntriesInRange(from: string, to: string) {
  const entries = useStoreSlice((s) => s.entries) ?? []

  useEffect(() => {
    store.loadEntries(from, to).catch(console.error)
  }, [from, to])

  const filtered = entries.filter((e) => {
    const ek = e.entryTimestamp.slice(0, 10)
    return ek >= from && ek <= to
  })

  return { entries: filtered, loading: filtered.length === 0 && entries.length === 0 }
}

export { store }
