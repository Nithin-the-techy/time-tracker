// The 9 fixed departments. Defense was removed; Infrastructure + Strategy merged.

export type SubType = 'fixed' | 'freeform'

export interface DepartmentSeed {
  slug: string
  name: string
  sortOrder: number
  subType: SubType
  moduleKey: 'generic' | 'education' | 'research' | 'engineering' | 'revenue'
  subdepartments: string[] // starter names, in display order
}

export const DEPARTMENTS: DepartmentSeed[] = [
  {
    slug: 'finance',
    name: 'Department of Finance',
    sortOrder: 1,
    subType: 'freeform',
    moduleKey: 'revenue',
    subdepartments: ['Tutoring', 'Web Dev Sales', 'Savings/Budgeting'],
  },
  {
    slug: 'education',
    name: 'Department of Education',
    sortOrder: 2,
    subType: 'freeform',
    moduleKey: 'education',
    subdepartments: [
      'Physics',
      'Math',
      'Chemistry',
      'English',
      'Tamil',
      'Extended Essay',
      'IAs',
      'University Applications',
    ],
  },
  {
    slug: 'health',
    name: 'Department of Health',
    sortOrder: 3,
    subType: 'freeform',
    moduleKey: 'generic',
    // Sleep is logged here and used as the daily baseline (defaults to 480 if unlogged).
    subdepartments: ['Sleep', 'Nutrition', 'Exercise'],
  },
  {
    slug: 'research',
    name: 'Department of Research',
    sortOrder: 4,
    subType: 'freeform',
    moduleKey: 'research',
    subdepartments: [
      'AI/ML Theory',
      'Neuroscience-Inspired Computing',
      'Math & Physics Foundations',
    ],
  },
  {
    slug: 'engineering',
    name: 'Department of Engineering',
    sortOrder: 5,
    subType: 'freeform',
    moduleKey: 'engineering',
    subdepartments: [],
  },
  {
    slug: 'relations',
    name: 'Department of Relations',
    sortOrder: 6,
    subType: 'freeform',
    moduleKey: 'generic',
    subdepartments: ['Family', 'Friends', 'New Connections'],
  },
  {
    slug: 'operations',
    name: 'Department of Infrastructure and Strategic Operations',
    sortOrder: 7,
    subType: 'freeform',
    moduleKey: 'generic',
    subdepartments: ['Tools & Workflow', 'Environment', 'Weekly Review', 'Prioritization', 'Long-Term Planning'],
  },
  {
    slug: 'communications',
    name: 'Department of Communications',
    sortOrder: 8,
    subType: 'freeform',
    moduleKey: 'generic',
    subdepartments: ['Academic/Application Writing', 'General Writing', 'Verbal/Presentation'],
  },
  {
    slug: 'intelligence',
    name: 'Department of Intelligence',
    sortOrder: 9,
    subType: 'freeform',
    moduleKey: 'generic',
    // Domain-general cognitive training. Physical exercise stays in Health → Exercise.
    subdepartments: ['Chess & Strategy Games', 'Meditation & Mindfulness', 'Cognitive Cross-Training', 'Diet & Brain Health'],
  },
]

// One color per department, stable across every chart.
export const DEPARTMENT_COLORS: Record<string, string> = {
  finance: '#38bdf8',
  education: '#2dd4bf',
  health: '#fbbf24',
  research: '#a78bfa',
  engineering: '#34d399',
  relations: '#f472b6',
  operations: '#818cf8',
  communications: '#fb923c',
  intelligence: '#22d3ee',
}

// Activities you can log as neutral time in the universal log. Sleep is
// special: it merges with Health → Sleep entries into the day's sleep total.
export const NEUTRAL_ACTIVITIES: { id: string; label: string }[] = [
  { id: 'sleep', label: 'Sleep' },
  { id: 'meals', label: 'Meals' },
  { id: 'hygiene', label: 'Hygiene' },
  { id: 'chores', label: 'Chores' },
  { id: 'commute', label: 'Commute' },
  { id: 'rest', label: 'Rest' },
]

// Suggested labels for negative (actively bad) time. Free-form labels are
// allowed too — this list is just quick chips in the log form.
export const NEGATIVE_ACTIVITIES: { id: string; label: string }[] = [
  { id: 'gaming', label: 'Gaming' },
  { id: 'social_media', label: 'Scrolling' },
  { id: 'video', label: 'Videos' },
  { id: 'web_browsing', label: 'Web browsing' },
  { id: 'idle', label: 'Idle' },
  { id: 'other', label: 'Other' },
]

// Legacy alias (existing data / imports use these ids).
export const UNPRODUCTIVE_TAGS = NEGATIVE_ACTIVITIES

// Red/orange family for negative slices in the composition donut.
export const NEGATIVE_COLORS = ['#ef4444', '#f87171', '#fb923c', '#f97316', '#dc2626', '#c2410c']

// Grey-blue family for neutral slices (sleep, meals, chores...).
export const NEUTRAL_COLORS = ['#64748b', '#94a3b8', '#7d8ca3', '#a8b3c5', '#5b6b80', '#8fa0b5']

// Muted dark red for unaccounted unproductive time (the derived remainder
// that was never labeled as a specific negative activity).
export const UNACCOUNTED_COLOR = '#7f2d2d'

// Neutral slice label for the assumed baseline on days without neutral logs.
export const NEUTRAL_DEFAULT_LABEL = 'Meals & recovery'

// Legacy form-prefill suggestions only. Metrics NEVER assume these — a day
// with no logs has no sleep and no neutral time until it is actually logged
// (or pinned for that day in Settings).
export const EAT_BATHE_DEFAULT_MINUTES = 90
export const DEFAULT_SLEEP_MINUTES = 480

// --- GPP (Gross Personal Product) ---
// The big abstract number on Progress: all-time productive time averaged per
// tracked day and extended to a month, valued at GPP_DOLLARS_PER_HOUR per
// productive hour.
//
// Calibration — $1T/month = the output of a top-performing human at the
// physical ceiling: 14 productive hours every single day, 30 days a month.
// The other 10h: 7h sleep + 1.5h meals/recovery (neutral) + 1.5h wasted
// (unproductive — under the 2h/day bar). That makes $1T hard but physically
// possible, and every logged hour reads as a fraction of world-class:
// 4h/day ≈ $286B/month ≈ 29% of the goal.
export const GPP_GOAL_DOLLARS = 1_000_000_000_000
export const GPP_TOP_PRODUCTIVE_HOURS_PER_DAY = 14
export const GPP_DOLLARS_PER_HOUR = GPP_GOAL_DOLLARS / (GPP_TOP_PRODUCTIVE_HOURS_PER_DAY * 30)
