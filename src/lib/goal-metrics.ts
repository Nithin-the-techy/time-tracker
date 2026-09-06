import type { Goal, GoalTarget } from './store'

export function targetProgress(target: GoalTarget): number {
  if (target.targetValue <= 0) return 0
  return Math.min(1, Math.max(0, target.currentValue / target.targetValue))
}

export function goalProgress(goal: Goal): number {
  // A goal without explicit targets is still real work: completed actions are
  // its measurable progress. Targets override this when the user wants a
  // more precise, weighted metric.
  if (goal.targets.length === 0) {
    const actions = goal.actions.filter((action) => action.status !== 'cancelled')
    if (actions.length === 0) return 0
    const planned = actions.reduce((sum, action) => sum + Math.max(1, action.plannedMinutes), 0)
    const completed = actions.filter((action) => action.status === 'completed').reduce((sum, action) => sum + Math.max(1, action.plannedMinutes), 0)
    return Math.min(1, completed / planned)
  }
  const totalWeight = goal.targets.reduce((sum, target) => sum + Math.max(0.01, target.weight), 0)
  return goal.targets.reduce((sum, target) => sum + targetProgress(target) * Math.max(0.01, target.weight), 0) / totalWeight
}

export function daysRemaining(targetDate: string, today = new Date()): number {
  const [y, m, d] = targetDate.split('-').map(Number)
  const target = Date.UTC(y, m - 1, d)
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.ceil((target - current) / 86_400_000)
}

export function formatTargetValue(value: number, unit: string): string {
  if (unit === 'minutes') {
    const hours = value / 60
    return hours < 10 && !Number.isInteger(hours) ? `${hours.toFixed(1)}h` : `${Math.round(hours)}h`
  }
  if (unit.toLowerCase() === 'inr') return `₹${Math.round(value).toLocaleString('en-IN')}`
  if (unit === 'percent') return `${Math.round(value)}%`
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`
}

