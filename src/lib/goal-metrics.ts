import type { Goal, GoalTarget } from './store'

export interface GoalProgressInfo {
  ratio: number | null
  completedSteps: number
  totalSteps: number
  label: string
  hasMeasure: boolean
}

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

/**
 * A percentage is only shown when the user has defined a fixed measurable
 * whole. Without one, a step count is more honest than a percentage that can
 * change merely because backlog work was added.
 */
export function goalProgressInfo(goal: Goal): GoalProgressInfo {
  const activeSteps = goal.actions.filter((action) => action.status !== 'cancelled')
  const completedSteps = activeSteps.filter((action) => action.status === 'completed').length
  if (goal.targets.length > 0) {
    const ratio = goalProgress(goal)
    return {
      ratio,
      completedSteps,
      totalSteps: activeSteps.length,
      label: `${Math.round(ratio * 100)}% complete`,
      hasMeasure: true,
    }
  }
  return {
    ratio: null,
    completedSteps,
    totalSteps: activeSteps.length,
    label: activeSteps.length > 0 ? `${completedSteps} of ${activeSteps.length} Steps done` : 'No progress measure yet',
    hasMeasure: false,
  }
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

