export type DepartmentModuleKey = 'generic' | 'education' | 'research' | 'engineering' | 'revenue'

export interface DepartmentModuleDefinition {
  key: DepartmentModuleKey
  label: string
  targetNoun: string
  problemPrompt: string
  actionPrompt: string
  outputPrompt: string
  suggestedUnits: string[]
  suggestedContexts: string[]
}

export const DEPARTMENT_MODULES: Record<DepartmentModuleKey, DepartmentModuleDefinition> = {
  generic: {
    key: 'generic',
    label: 'Generic',
    targetNoun: 'target',
    problemPrompt: 'What gap prevents this goal from being complete?',
    actionPrompt: 'What concrete action moves the goal?',
    outputPrompt: 'What observable proof will exist?',
    suggestedUnits: ['percent', 'count', 'minutes', 'hours'],
    suggestedContexts: ['deep', 'school/practice', 'phone', 'errand'],
  },
  education: {
    key: 'education',
    label: 'Education',
    targetNoun: 'subject target',
    problemPrompt: 'What subject gap or exam weakness is still open?',
    actionPrompt: 'Which exact topic, paper, or writing drill will you do?',
    outputPrompt: 'Questions attempted, corrections made, or pages produced',
    suggestedUnits: ['minutes', 'questions', 'papers', 'topics'],
    suggestedContexts: ['deep study', 'school/practice', 'flashcards', 'writing'],
  },
  research: {
    key: 'research',
    label: 'Research',
    targetNoun: 'evidence target',
    problemPrompt: 'Which uncertainty, assumption, or missing capability blocks the thesis?',
    actionPrompt: 'What reading, derivation, simulation, or experiment comes next?',
    outputPrompt: 'Claim, derivation, experiment result, or evidence artifact',
    suggestedUnits: ['experiments', 'claims', 'papers', 'minutes'],
    suggestedContexts: ['deep research', 'school/practice', 'reading', 'simulation'],
  },
  engineering: {
    key: 'engineering',
    label: 'Engineering',
    targetNoun: 'milestone',
    problemPrompt: 'What bug, missing behavior, or technical risk blocks the release?',
    actionPrompt: 'What buildable or testable change comes next?',
    outputPrompt: 'Commit, passing test, deployed behavior, or design decision',
    suggestedUnits: ['milestones', 'tests', 'features', 'minutes'],
    suggestedContexts: ['deep build', 'school/practice', 'debugging', 'review'],
  },
  revenue: {
    key: 'revenue',
    label: 'Revenue',
    targetNoun: 'pipeline target',
    problemPrompt: 'Which offer, lead, proof, or delivery gap blocks collected revenue?',
    actionPrompt: 'What outreach, proposal, delivery, or collection action comes next?',
    outputPrompt: 'Lead contacted, proposal sent, deliverable accepted, or money collected',
    suggestedUnits: ['INR', 'leads', 'proposals', 'clients'],
    suggestedContexts: ['school/practice', 'phone', 'deep delivery', 'outreach'],
  },
}

export function departmentModule(key: string | null | undefined): DepartmentModuleDefinition {
  return DEPARTMENT_MODULES[(key as DepartmentModuleKey) ?? 'generic'] ?? DEPARTMENT_MODULES.generic
}

