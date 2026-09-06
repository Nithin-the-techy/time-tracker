# Operations: goal engine specification (superseded draft)

Status: **do not implement or deploy from this document.** Nithin rejected the baked exam template, the separate Today workflow, verbose product copy, and implementation before design approval. The branch is a prototype only. A replacement architecture must be presented as a complete proposal and explicitly approved before code, schema, data, or deployment changes continue.

The replacement must preserve these constraints:

- `Sprint` is universal and user-created; exams are only one possible use.
- The normal application starts without personal goals, subjects, actions, or targets.
- Goals, focus sessions, and the canonical log are one connected system: all goal work links to a log, while general logs may remain unlinked.
- Working UI copy is minimal.
- Goal creation/management/execution and Progress/History views must not become competing sources of truth.

The remaining content below records the earlier prototype design for historical comparison, not approval.

## Product claim

Operations is not a diary of time already lost. It is a single-user execution
system that helps the user choose the right next action, begin it, produce an
observable result, recover quickly after avoidance, and learn from the evidence.

It should orchestrate almost the entire execution loop. It cannot honestly
promise control over another app, the user's body, or their choices; device
blocking and environmental enforcement remain external layers.

## The execution loop

```text
Goal -> measurable targets -> current gaps/problems -> next actions
     -> focus session -> output/evidence -> target progress -> review
                                      \-> interruption/recovery -> next action
```

The default screen answers only three questions:

1. What matters now?
2. What is the smallest concrete action I can start?
3. What proof will exist when the action is done?

Historical charts, GPP, rivals, and weights remain available, but are not the
primary moment-of-choice interface.

## Universal model

### Department

A customizable area of life. Each department chooses one operating module:

- `generic`: percentage, quantity, or binary outcomes.
- `education`: subjects, planned study minutes, syllabus/output milestones.
- `research`: questions, hypotheses, experiments, evidence artifacts.
- `engineering`: projects, milestones, bugs, builds, releases.
- `revenue`: offers, leads, proposals, delivery, collected revenue.

Modules are presentation and workflow adapters. They do not create separate
goal tables or incompatible systems. A new module can be added in code without
migrating every goal.

### Goal

A desired state inside a department.

Required:

- title;
- department and operating module;
- start and target date;
- status: draft, active, paused, completed, or abandoned;
- priority;
- outcome statement: the observable state that means success.

Optional:

- parent goal, for long-horizon goals and projects;
- why-now statement;
- constraints;
- review cadence.

A goal's percent is derived from its targets. It is never a manually invented
confidence score.

### Target

A measurable component of a goal. Targets make “100%” explicit.

- label, target value, current value, and unit;
- progress source: manual, productive minutes, completed actions, or outputs;
- optional subdepartment/subject;
- weight within the parent goal.

Examples:

- Education: Physics 870 of 870 planned revision minutes.
- Revenue: Rs 5,000 collected.
- Research: three falsifiable experiments completed.
- Engineering: exam generator MVP passes ten acceptance scenarios.

### Problem

A current gap that prevents a goal from reaching 100%.

- concise statement;
- severity and status;
- optional target it blocks;
- next action;
- evidence that would count as solved.

Problems are not journal entries. Open problems without a next action appear as
unresolved and block the goal's readiness indicator.

### Action

An executable unit of work.

- verb-first title;
- goal and optional problem;
- context: deep, school/practice, phone, errand, or any custom value;
- planned minutes;
- due/available date;
- status and sort order;
- definition of done / expected output.

The Today screen shows at most three committed actions. A backlog may be large;
the commitment list may not.

### Focus session

An intentional start/stop record linked to an action. A session can be running,
completed, interrupted, or abandoned.

On start, the UI shows the action, expected output, elapsed time, and one stop
control. On stop, it asks for actual minutes, output/evidence, and the next
action. Completed focus sessions create productive time entries so the existing
analytics remain useful.

### Check-in and recovery

Recovery is a first-class state transition, not a broken streak.

- A quick check-in records energy, friction, and whether the user is on plan.
- “I drifted” records the interruption without moral drama.
- The rescue flow offers: resume, shrink to ten minutes, switch to an approved
  low-context action, or deliberately rest.
- The recovery metric is time from interruption to the next started session.

## First configured goal: exam sprint

The exam sprint is ordinary Education data, not special-case code.

- One active Education goal representing sustained planned effort through the
  exam period.
- One target per subject. Initial planning baseline: Physics 870 min,
  Chemistry 660 min, Math 660 min, English 660 min, and CS 300 min.
- Success of the discipline experiment is planned minutes honestly attempted,
  not a guarantee of marks or completion of every ambition.
- School/annual-practice context contains only interruptible work such as
  exam-generator planning, outreach research, editing, or flashcards.
- Deep study remains a separate context.

All labels, dates, targets, and contexts remain editable.

## Today screen

Order matters:

1. Current sprint: days remaining, planned versus completed effort, and target
   progress.
2. Running session, if any.
3. Up to three committed actions with Start controls.
4. Quick rescue and quick log.
5. Goal problems that have no next action.
6. Compact daily evidence: productive, explicitly negative, neutral, unknown.

The trillion-dollar GPP panel remains as a collapsible “mythic scoreboard.” It
is an identity/metaphor layer and is labelled as such. It must not pretend to be
financial output or outrank the current sprint.

## Time-accounting truth rules

- Future minutes are never unproductive.
- Unlogged minutes are unknown, not negative.
- Explicit negative logs are negative.
- Neutral and productive totals come only from logs or clearly labelled per-day
  overrides.
- Current-day composition covers elapsed time only.
- Historical silent days are no-data unless the user explicitly closes the day.
- Date iteration uses calendar keys directly and never round-trips local
  midnight through UTC.
- A day cannot contain more than 1,440 logged minutes; APIs reject invalid
  durations, cross-department subdepartments, and impossible totals.

## Deployment and data safety

- Production builds generate Prisma clients only. They never run
  `db push --accept-data-loss`.
- Schema changes use reviewed migrations, applied as a separate deployment
  operation after a JSON backup.
- Import validates the whole payload before deleting anything and restores all
  new goal-engine entities.
- Authentication requires a non-default app password and a strong independent
  signing secret in production.
- Login rate limiting is required before broader exposure.

## Delivery slices

### Slice 0: make existing data honest and deployment safe

- Correct elapsed/unknown/negative calculations and local date iteration.
- Fix neutral inconsistency in Database.
- Strengthen entry validation and deletion error handling.
- Remove destructive database mutation from the build command.
- Add unit tests for dates and time accounting.

### Slice 1: complete goal-to-action loop

- Add department modules, goals, targets, problems, actions, and focus sessions.
- Add APIs, export/import support, cache hooks, and a Today screen.
- Add reusable goal editor; configure the exam sprint through normal UI/data.
- Starting and completing an action must work end-to-end and create evidence.

### Slice 2: department-specific workbenches

- Education target grid and subject coverage.
- Research question/experiment/evidence view.
- Engineering milestone/acceptance-test view.
- Revenue pipeline and collected-revenue target view.

### Slice 3: recovery and enforcement interfaces

- Check-ins, interruption events, rescue flow, recovery-latency metric.
- Context queues for school/practice versus deep work.
- Exportable blocker schedule / integration hooks for device-level enforcement.

### Slice 4: hardening

- Edit flows, overlap detection, optimistic-state recovery, rate limiting,
  accessibility checks, CI, migration rehearsal, and production deployment.

## Slice 1 acceptance tests

1. A custom department can choose or change an operating module.
2. A user can create an Education goal and add arbitrary subject targets.
3. A user can write a problem, attach a next action, and see it on Today.
4. A user can commit up to three Today actions.
5. Start persists a running focus session across refreshes.
6. Finish records duration and output and advances linked progress.
7. A session-created time entry appears in the existing Database analytics.
8. The exam goal is editable and uses no exam-only database table or route.
9. GPP still exists but is secondary and explicitly described as metaphorical.
10. Existing backup data imports without loss; new backups include new entities.

## Non-goals for the first vertical slice

- autonomous blocking of other Windows/phone apps;
- AI-generated schedules that silently rewrite commitments;
- public multi-user accounts;
- gamified punishment or irreversible consequences;
- claiming that logged hours prove learning, revenue, or research quality.
