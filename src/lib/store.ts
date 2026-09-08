// Client store. Thin cache over the API routes; components subscribe via hooks.

export interface Subdepartment {
  id: string
  departmentId: string
  name: string
  isActive: boolean
  sortOrder: number
  valueWeight: number
}

export interface Department {
  id: string
  name: string
  slug: string
  sortOrder: number
  subType: 'fixed' | 'freeform'
  moduleKey: 'generic' | 'education' | 'research' | 'engineering' | 'revenue'
  subdepartments: Subdepartment[]
}

export interface Entry {
  id: string
  departmentId: string
  subdepartmentId: string | null
  entryTimestamp: string // ISO
  durationMinutes: number
  note: string | null
  obsidianRef: string | null
  createdAt: string
  // The API always nests the Area and Department; sessionContext is present for
  // entries created from a running Session.
  department: {
    id: string
    name: string
    slug: string
    sortOrder: number
    subType: 'fixed' | 'freeform'
    moduleKey: 'generic' | 'education' | 'research' | 'engineering' | 'revenue'
  }
  subdepartment: {
    id: string
    name: string
    valueWeight: number
  } | null
  sessionContext?: {
    goalId: string
    actionTitle: string
    goalTitle: string
    sprintName: string | null
    sessionStatus: 'completed' | 'stopped' | 'interrupted' | 'abandoned' | 'running'
  } | null
}

export interface WeeklyReview {
  id: string
  weekStartDate: string // YYYY-MM-DD
  whatMattered: string | null
  bottleneck: string | null
  nextChange: string | null
  updatedAt: string
}

export interface WeightChange {
  id: string
  subdepartmentId: string
  subdepartmentName: string
  departmentName: string
  slug: string
  oldWeight: number
  newWeight: number
  changedAt: string
}

export interface RivalSectorEstimate {
  id: string
  subdepartmentId: string
  subdepartmentName: string
  departmentName: string
  estimatedWeeklyMinutes: number
  weight: number
}

export interface Rival {
  id: string
  name: string
  regionLabel: string
  notes: string | null
  sectorEstimates: RivalSectorEstimate[]
}

export interface UnproductiveBlock {
  id: string
  date: string // YYYY-MM-DD
  tag: string
  minutes: number
  note: string | null
  createdAt: string
}

export interface NeutralEntry {
  id: string
  date: string // YYYY-MM-DD
  activity: string // 'sleep' | meals / hygiene / chores / ...
  minutes: number
  note: string | null
  createdAt: string
}

export interface DayAllowance {
  date: string // YYYY-MM-DD
  sleepMinutes: number | null // null = default behavior
  neutralMinutes: number | null // null = default behavior
}

export interface WorkspacePreference {
  timezone: string
}

export type GoalStatus = 'draft' | 'active' | 'paused' | 'completed' | 'abandoned' | 'archived'
export type ActionStatus = 'backlog' | 'today' | 'in_progress' | 'completed' | 'cancelled' | 'archived'
export type SessionDisposition = 'complete_step' | 'stop_keep_today' | 'stop_to_backlog' | 'interrupted_keep_today' | 'interrupted_to_backlog'

export interface GoalTarget {
  id: string
  goalId: string
  subdepartmentId: string | null
  label: string
  unit: string
  targetValue: number
  currentValue: number
  progressSource: 'manual' | 'productive_minutes' | 'completed_actions' | 'outputs'
  weight: number
  sortOrder: number
  progressValue: number
  progressRatio: number
  subdepartment: Subdepartment | null
}

export interface GoalProblem {
  id: string
  goalId: string
  targetId: string | null
  statement: string
  evidence: string | null
  severity: number
  status: 'open' | 'solved' | 'accepted'
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface WorkSession {
  id: string
  actionId: string
  entryId: string | null
  startedAt: string
  endedAt: string | null
  status: 'running' | 'completed' | 'stopped' | 'interrupted' | 'abandoned'
  actualMinutes: number | null
  output: string | null
  friction: string | null
}

export interface GoalAction {
  id: string
  goalId: string
  targetId: string | null
  problemId: string | null
  subdepartmentId: string | null
  title: string
  context: string
  plannedMinutes: number
  dueDate: string | null
  status: ActionStatus
  todayOrder: number | null
  definitionOfDone: string | null
  output: string | null
  createdAt: string
  updatedAt: string
  target: GoalTarget | null
  problem: GoalProblem | null
  subdepartment: Subdepartment | null
  sessions: WorkSession[]
}

export interface Goal {
  id: string
  departmentId: string
  title: string
  outcome: string
  whyNow: string | null
  constraints: string | null
  moduleKey: Department['moduleKey']
  status: GoalStatus
  priority: number
  startDate: string
  targetDate: string
  reviewCadence: string
  createdAt: string
  updatedAt: string
  department: Department
  targets: GoalTarget[]
  problems: GoalProblem[]
  actions: GoalAction[]
  sprintLinks?: SprintGoal[]
}

export interface SprintGoal {
  sprintId: string
  goalId: string
  sortOrder: number
  addedAt: string
  goal: Goal
}

export type SprintStatus = 'planned' | 'active' | 'paused' | 'completed' | 'archived'

export interface Sprint {
  id: string
  name: string
  phase: string | null
  status: SprintStatus
  startDate: string
  endDate: string
  notes: string | null
  createdAt: string
  updatedAt: string
  goals: SprintGoal[]
}

export interface AppState {
  departments: Department[]
  entries: Entry[]
  weeklyReviews: WeeklyReview[]
  weightChanges: WeightChange[]
  rivals: Rival[]
  unproductiveBlocks: UnproductiveBlock[]
  neutralEntries: NeutralEntry[]
  allowances: DayAllowance[]
  goals: Goal[]
  sprints: Sprint[]
  preference: WorkspacePreference
}

// --- Cache + subscription ---
let cached: Partial<AppState> = {}
const listeners = new Set<() => void>()
const inflight: Record<string, Promise<unknown>> = {}

function notify() {
  for (const l of listeners) l()
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

async function getJson(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`)
  return res.json()
}
async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error((e as { error?: string }).error || `POST ${url} failed: ${res.status}`)
  }
  return res.json()
}
async function patchJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error((e as { error?: string }).error || `PATCH ${url} failed: ${res.status}`)
  }
  return res.json()
}
async function putJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error((e as { error?: string }).error || `PUT ${url} failed: ${res.status}`)
  }
  return res.json()
}

async function deleteJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error((e as { error?: string }).error || `DELETE ${url} failed: ${res.status}`)
  }
  return res.json()
}

// Full-range keys — data is tiny (a few MB at years of use), so we cache all
// entries and filter client-side.
const ALL_FROM = '2000-01-01'
const ALL_TO = '2099-12-31'

export const store = {
  subscribe,
  getCache: () => cached,

  async bootstrap() {
    if (inflight.bootstrap !== undefined) return inflight.bootstrap as Promise<void>
    inflight.bootstrap = (async () => {
      try {
        const browserTimeZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
        // Establish the workspace timezone before any date-bounded request so
        // the first bootstrap cannot race a UTC fallback.
        const preferenceRes = await getJson(`/api/workspace/preferences?timezone=${encodeURIComponent(browserTimeZone)}`)
        const [deptRes, rivalsRes, weightsRes, entriesRes, allowancesRes, blocksRes, neutralRes, goalsRes, sprintsRes] = await Promise.all([
          getJson('/api/departments'),
          getJson('/api/rivals'),
          getJson('/api/weights'),
          getJson(`/api/entries?from=${ALL_FROM}&to=${ALL_TO}`),
          getJson('/api/allowances'),
          getJson(`/api/unproductive-blocks?from=${ALL_FROM}&to=${ALL_TO}`),
          getJson(`/api/neutral-entries?from=${ALL_FROM}&to=${ALL_TO}`),
          getJson('/api/goals'),
          getJson('/api/sprints'),
        ])
        cached = {
          ...cached,
          departments: deptRes.departments as Department[],
          rivals: rivalsRes.rivals as Rival[],
          weightChanges: weightsRes.changes as WeightChange[],
          entries: entriesRes.entries as Entry[],
          allowances: allowancesRes.allowances as DayAllowance[],
          unproductiveBlocks: blocksRes.blocks as UnproductiveBlock[],
          neutralEntries: neutralRes.entries as NeutralEntry[],
          goals: goalsRes.goals as Goal[],
          sprints: sprintsRes.sprints as Sprint[],
          preference: preferenceRes.preference as WorkspacePreference,
        }
        if (typeof window !== 'undefined') window.localStorage.setItem('operations-workspace-timezone', (preferenceRes.preference as WorkspacePreference).timezone)
        notify()
      } finally {
        delete inflight.bootstrap
      }
    })()
    return inflight.bootstrap
  },

  async reload() {
    return this.bootstrap()
  },

  async loadDepartments() {
    const data = await getJson('/api/departments')
    cached.departments = data.departments as Department[]
    notify()
  },

  async addDepartment(name: string, moduleKey: Department['moduleKey']) {
    await postJson('/api/departments', { name, moduleKey })
    await this.loadDepartments()
  },

  async updateDepartment(id: string, input: { name?: string; moduleKey?: Department['moduleKey'] }) {
    await patchJson('/api/departments', { id, ...input })
    await this.loadDepartments()
  },

  // Range loads MERGE into the cache (never shrink it). Components request
  // overlapping windows all the time; replacing the cache per request would
  // let a narrow load wipe a wide one mid-flight.
  async loadEntries(from: string, to: string) {
    const data = await getJson(`/api/entries?from=${from}&to=${to}`)
    const incoming = data.entries as Entry[]
    const byId = new Map((cached.entries ?? []).map((e) => [e.id, e]))
    for (const e of incoming) byId.set(e.id, e)
    cached.entries = Array.from(byId.values())
    notify()
  },

  async addEntry(input: {
    departmentId: string
    subdepartmentId?: string
    subdepartmentName?: string
    entryTimestamp: string
    durationMinutes: number
    note?: string | null
    obsidianRef?: string | null
  }) {
    await postJson('/api/entries', {
      departmentId: input.departmentId,
      durationMinutes: input.durationMinutes,
      entryTimestamp: input.entryTimestamp,
      note: input.note ?? null,
      obsidianRef: input.obsidianRef ?? null,
      ...(input.subdepartmentId ? { subdepartmentId: input.subdepartmentId } : {}),
      ...(input.subdepartmentName ? { subdepartmentName: input.subdepartmentName } : {}),
    })
    await this.loadDepartments()
    await this.loadEntries(ALL_FROM, ALL_TO)
  },

  async deleteEntry(id: string) {
    await deleteJson(`/api/entries/${id}`)
    cached.entries = (cached.entries ?? []).filter((e) => e.id !== id)
    notify()
  },

  // --- Sub-departments ---
  async addSubdepartment(departmentId: string, name: string) {
    await postJson('/api/subdepartments', { departmentId, name })
    await this.loadDepartments()
  },

  async archiveSubdepartment(id: string) {
    await patchJson(`/api/subdepartments/${id}`, { isActive: false })
    await this.loadDepartments()
  },

  // --- Weights ---
  async updateWeight(subdepartmentId: string, newWeight: number) {
    await patchJson('/api/weights', { subdepartmentId, newWeight })
    await this.loadDepartments()
    const w = await getJson('/api/weights')
    cached.weightChanges = w.changes as WeightChange[]
    notify()
  },

  // --- Weekly reviews ---
  async getReview(weekStart: string): Promise<WeeklyReview | null> {
    const data = await getJson(`/api/weekly-reviews?weekStart=${weekStart}`)
    return data.review
  },

  async saveReview(input: { weekStartDate: string; whatMattered: string | null; bottleneck: string | null; nextChange: string | null }) {
    return postJson('/api/weekly-reviews', input)
  },

  // --- Rivals ---
  async loadRivals() {
    const data = await getJson('/api/rivals')
    cached.rivals = data.rivals as Rival[]
    notify()
  },

  async addRival(input: { name: string; regionLabel: string; notes?: string | null }) {
    await postJson('/api/rivals', input)
    await this.loadRivals()
  },

  async updateRival(id: string, input: { name?: string; regionLabel?: string; notes?: string | null; sectorEstimates?: Array<{ subdepartmentId: string; estimatedWeeklyMinutes: number }> }) {
    await patchJson(`/api/rivals/${id}`, input)
    await this.loadRivals()
  },

  async deleteRival(id: string) {
    await deleteJson(`/api/rivals/${id}`)
    await this.loadRivals()
  },

  // --- Explicit negative time blocks ---
  async loadUnproductiveBlocks(from: string, to: string) {
    const data = await getJson(`/api/unproductive-blocks?from=${from}&to=${to}`)
    cached.unproductiveBlocks = data.blocks as UnproductiveBlock[]
    notify()
  },

  async addUnproductiveBlock(input: { date: string; tag: string; minutes: number; note?: string | null }) {
    await postJson('/api/unproductive-blocks', input)
    await this.loadUnproductiveBlocks(ALL_FROM, ALL_TO)
  },

  async deleteUnproductiveBlock(id: string) {
    await deleteJson(`/api/unproductive-blocks/${id}`)
    cached.unproductiveBlocks = (cached.unproductiveBlocks ?? []).filter((b) => b.id !== id)
    notify()
  },

  // --- Neutral time logs (sleep, meals, chores...) ---
  async loadNeutralEntries(from: string, to: string) {
    const data = await getJson(`/api/neutral-entries?from=${from}&to=${to}`)
    cached.neutralEntries = data.entries as NeutralEntry[]
    notify()
  },

  async addNeutralEntry(input: { date: string; activity: string; minutes: number; note?: string | null }) {
    await postJson('/api/neutral-entries', input)
    await this.loadNeutralEntries(ALL_FROM, ALL_TO)
  },

  async deleteNeutralEntry(id: string) {
    await deleteJson(`/api/neutral-entries/${id}`)
    cached.neutralEntries = (cached.neutralEntries ?? []).filter((n) => n.id !== id)
    notify()
  },

  // --- Per-day allowances (sleep / neutral overrides) ---
  async setAllowance(input: { date: string; sleepMinutes?: number | null; neutralMinutes?: number | null }) {
    await putJson('/api/allowances', input)
    const data = await getJson('/api/allowances')
    cached.allowances = data.allowances as DayAllowance[]
    notify()
  },

  async clearAllowance(date: string) {
    await deleteJson('/api/allowances', { date })
    cached.allowances = (cached.allowances ?? []).filter((a) => a.date !== date)
    notify()
  },

  // --- Goals, problems, actions, and intentional sessions ---
  async loadGoals() {
    const data = await getJson('/api/goals')
    cached.goals = data.goals as Goal[]
    notify()
  },

  async loadSprints() {
    const data = await getJson('/api/sprints')
    cached.sprints = data.sprints as Sprint[]
    notify()
  },

  async refreshWork() {
    await Promise.all([this.loadGoals(), this.loadSprints()])
  },

  async updateWorkspaceTimeZone(timezone: string) {
    const data = await patchJson('/api/workspace/preferences', { timezone })
    cached.preference = data.preference as WorkspacePreference
    if (typeof window !== 'undefined') window.localStorage.setItem('operations-workspace-timezone', cached.preference.timezone)
    notify()
  },

  async createSprint(input: { name: string; startDate: string; endDate: string; status?: SprintStatus; goalIds?: string[] }) {
    await postJson('/api/sprints', input)
    await this.refreshWork()
  },

  async updateSprint(id: string, input: Partial<Pick<Sprint, 'name' | 'phase' | 'status' | 'startDate' | 'endDate' | 'notes'>> & { goalIds?: string[] }) {
    await patchJson(`/api/sprints/${id}`, input)
    await this.refreshWork()
  },

  async moveGoalToSprint(goalId: string, sprintId: string) {
    await patchJson(`/api/sprints/${sprintId}`, { moveGoalId: goalId })
    await Promise.all([this.loadSprints(), this.loadGoals()])
  },

  async createGoal(input: {
    departmentId: string
    title: string
    outcome: string
    startDate: string
    targetDate: string
    priority?: number
    whyNow?: string | null
    constraints?: string | null
    sprintId?: string | null
  }) {
    const data = await postJson('/api/goals', input)
    await this.loadGoals()
    await this.loadSprints()
    return data.goal as Goal
  },

  async updateGoal(id: string, input: Partial<Pick<Goal, 'title' | 'outcome' | 'whyNow' | 'constraints' | 'priority' | 'status' | 'startDate' | 'targetDate'>>) {
    await patchJson(`/api/goals/${id}`, input)
    await this.refreshWork()
  },

  async setGoalSprint(goalId: string, sprintId: string | null) {
    await patchJson(`/api/goals/${goalId}`, { sprintId })
    await this.refreshWork()
  },

  async deleteGoal(id: string) {
    await deleteJson(`/api/goals/${id}`)
    await this.refreshWork()
  },

  async addGoalTarget(input: {
    goalId: string
    subdepartmentId?: string | null
    label: string
    unit: string
    targetValue: number
    currentValue?: number
    progressSource?: GoalTarget['progressSource']
    weight?: number
  }) {
    await postJson('/api/goal-targets', input)
    await this.refreshWork()
  },

  async updateGoalTarget(id: string, input: Partial<Pick<GoalTarget, 'label' | 'unit' | 'targetValue' | 'currentValue' | 'weight' | 'progressSource'>>) {
    await patchJson('/api/goal-targets', { id, ...input })
    await this.refreshWork()
  },

  async deleteGoalTarget(id: string) {
    await deleteJson('/api/goal-targets', { id })
    await this.refreshWork()
  },

  async addGoalProblem(input: { goalId: string; targetId?: string | null; statement: string; evidence?: string | null; severity?: number }) {
    await postJson('/api/goal-problems', input)
    await this.refreshWork()
  },

  async updateGoalProblem(id: string, input: Partial<Pick<GoalProblem, 'statement' | 'evidence' | 'severity' | 'status'>>) {
    await patchJson('/api/goal-problems', { id, ...input })
    await this.refreshWork()
  },

  async deleteGoalProblem(id: string) {
    await deleteJson('/api/goal-problems', { id })
    await this.refreshWork()
  },

  async addGoalAction(input: {
    goalId: string
    targetId?: string | null
    problemId?: string | null
    subdepartmentId?: string | null
    title: string
    context: string
    plannedMinutes: number
    dueDate?: string | null
    status?: ActionStatus
    definitionOfDone?: string | null
  }) {
    await postJson('/api/goal-actions', input)
    await this.refreshWork()
  },

  async updateGoalAction(id: string, input: Partial<Pick<GoalAction, 'title' | 'context' | 'plannedMinutes' | 'status' | 'definitionOfDone' | 'output' | 'dueDate' | 'subdepartmentId'>>) {
    await patchJson('/api/goal-actions', { id, ...input })
    await this.refreshWork()
  },

  async deleteGoalAction(id: string) {
    await deleteJson('/api/goal-actions', { id })
    await this.refreshWork()
  },

  async startSession(actionId: string) {
    await postJson('/api/sessions', { operation: 'start', actionId })
    await this.refreshWork()
  },

  async finishSession(input: { sessionId: string; actualMinutes: number; resultNote?: string | null; friction?: string | null; disposition: SessionDisposition }, options?: { refresh?: boolean }) {
    const result = await postJson('/api/sessions', { operation: 'finish', ...input })
    if (options?.refresh === false) {
      await this.loadEntries(ALL_FROM, ALL_TO)
      return result
    }
    await Promise.all([this.refreshWork(), this.loadEntries(ALL_FROM, ALL_TO)])
    return result
  },

  async addManualSession(input: { actionId: string; actualMinutes: number; entryTimestamp: string; resultNote?: string | null }) {
    const result = await postJson('/api/sessions', { operation: 'manual', ...input })
    await Promise.all([this.refreshWork(), this.loadEntries(ALL_FROM, ALL_TO)])
    return result
  },

  // --- Backup ---
  async exportJSON(): Promise<string> {
    const data = await getJson('/api/export')
    return JSON.stringify(data, null, 2)
  },

  async importJSON(json: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(json)
      await postJson('/api/import', parsed)
      await this.bootstrap()
      return true
    } catch {
      return false
    }
  },

  async logout() {
    await postJson('/api/auth/logout', {})
    window.location.replace('/login')
  },
}
