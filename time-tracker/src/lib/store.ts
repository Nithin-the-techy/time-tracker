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
  subdepartments: Subdepartment[]
}

export interface Entry {
  id: string
  departmentId: string
  subdepartmentId: string
  entryTimestamp: string // ISO
  durationMinutes: number
  note: string | null
  obsidianRef: string | null
  createdAt: string
  // The API always nests these two on every entry.
  department: {
    id: string
    name: string
    slug: string
    sortOrder: number
    subType: 'fixed' | 'freeform'
  }
  subdepartment: {
    id: string
    name: string
    valueWeight: number
  }
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

export interface AppState {
  departments: Department[]
  entries: Entry[]
  weeklyReviews: WeeklyReview[]
  weightChanges: WeightChange[]
  rivals: Rival[]
  unproductiveBlocks: UnproductiveBlock[]
  neutralEntries: NeutralEntry[]
  allowances: DayAllowance[]
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
        const [deptRes, rivalsRes, weightsRes, entriesRes, allowancesRes, blocksRes, neutralRes] = await Promise.all([
          getJson('/api/departments'),
          getJson('/api/rivals'),
          getJson('/api/weights'),
          getJson(`/api/entries?from=${ALL_FROM}&to=${ALL_TO}`),
          getJson('/api/allowances'),
          getJson(`/api/unproductive-blocks?from=${ALL_FROM}&to=${ALL_TO}`),
          getJson(`/api/neutral-entries?from=${ALL_FROM}&to=${ALL_TO}`),
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
        }
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
    await fetch(`/api/entries/${id}`, { method: 'DELETE' })
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
    await fetch(`/api/rivals/${id}`, { method: 'DELETE' })
    await this.loadRivals()
  },

  // --- Negative time blocks (label the derived unproductive remainder) ---
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
    await fetch(`/api/unproductive-blocks/${id}`, { method: 'DELETE' })
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
    await fetch(`/api/neutral-entries/${id}`, { method: 'DELETE' })
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
    await fetch('/api/allowances', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    })
    cached.allowances = (cached.allowances ?? []).filter((a) => a.date !== date)
    notify()
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
    window.location.href = '/login'
  },
}
