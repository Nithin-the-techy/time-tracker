export type SessionDisposition =
  | 'complete_step'
  | 'stop_keep_today'
  | 'stop_to_backlog'
  | 'interrupted_keep_today'
  | 'interrupted_to_backlog'

export type SessionFinishState = {
  sessionStatus: 'completed' | 'stopped' | 'interrupted'
  actionStatus: 'completed' | 'today' | 'backlog'
  clearsTodayOrder: boolean
  createsEntry: true
}

export function sessionFinishState(disposition: SessionDisposition): SessionFinishState {
  if (disposition === 'complete_step') {
    return { sessionStatus: 'completed', actionStatus: 'completed', clearsTodayOrder: true, createsEntry: true }
  }
  if (disposition === 'stop_to_backlog') {
    return { sessionStatus: 'stopped', actionStatus: 'backlog', clearsTodayOrder: true, createsEntry: true }
  }
  if (disposition === 'interrupted_to_backlog') {
    return { sessionStatus: 'interrupted', actionStatus: 'backlog', clearsTodayOrder: true, createsEntry: true }
  }
  if (disposition === 'stop_keep_today') return { sessionStatus: 'stopped', actionStatus: 'today', clearsTodayOrder: false, createsEntry: true }
  return { sessionStatus: 'interrupted', actionStatus: 'today', clearsTodayOrder: false, createsEntry: true }
}
