# Operations: goal and Sprint engine

Status: implemented baseline for the universal execution system.

The replacement must preserve these constraints:

- `Sprint` is universal and user-created; exams are only one possible use.
- The normal application starts without personal goals, subjects, actions, or targets.
- Goals, focus sessions, and the canonical log are one connected system: all goal work links to a log, while general logs may remain unlinked.
- Working UI copy is minimal.
- Goal creation/management/execution and Progress/History views must not become competing sources of truth.

The application starts empty of personal goals and Sprints. Exams, research, revenue, and other phases are ordinary user-created data.

## Product claim

Operations is not a diary of time already lost. It is a single-user execution
system that helps the user choose the right next step, begin it, produce an
observable result, recover quickly after avoidance, and learn from the evidence.

It should orchestrate almost the entire execution loop. It cannot honestly
promise control over another app, the user's body, or their choices; device
blocking and environmental enforcement remain external layers.

## The execution loop

```text
Outcome -> measurable targets -> current gaps/problems -> next steps
        -> focus session -> output/evidence -> target progress -> review
                                         \-> interruption/recovery -> next step
```

The Work screen answers only three questions:

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

### Outcome (stored as `Goal`)

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
- next step;
- evidence that would count as solved.

Problems are not journal entries. Open problems without a next step appear as
unresolved and block the goal's readiness indicator.

### Step (stored as `GoalAction`)

An executable unit of work.

- verb-first title;
- goal and optional problem;
- context: deep, school/practice, phone, errand, or any custom value;
- planned minutes;
- due/available date;
- status and sort order;
- definition of done / expected output.

The active-work list shows at most three committed steps. A backlog may be
large; the commitment list may not.

### Focus session

An intentional start/stop record linked to an action. A session can be running,
completed, interrupted, or abandoned.

On start, the UI shows the step, optional expected output, elapsed time, and
stop controls. Completing a session requires one concise line of proof; the UI
must label this requirement before submission. Interrupted or abandoned
sessions may record optional friction without fake evidence. Completed focus
sessions create productive time entries so the existing analytics remain useful.

### Check-in and recovery

Recovery is a first-class state transition, not a broken streak.

- A quick check-in records energy, friction, and whether the user is on plan.
- “I drifted” records the interruption without moral drama.
- Recovery offers: resume, choose a smaller scope, switch to another action, or
  deliberately rest.
- The recovery metric is time from interruption to the next started session.

## User-created Sprints

A Sprint is a multi-day or multi-week phase. It can contain goals from several
departments and begins with no personal defaults. Education, research, revenue,
engineering, or any other phase uses the same Sprint model.

## Work and Progress surfaces

Order and ownership both matter:

Progress is the first tab and default landing view. It owns GPP, composition,
and historical charts. Work is the second tab and owns setup and execution:
Sprints, outcomes, the current focus, the running session, up to three
committed steps, scope adjustment, and recovery. The two views share data but
must not duplicate controls or create competing sources of truth.

The running session shows elapsed time and remaining planned time. Completing,
interrupting, or abandoning a session records the outcome; interruption keeps
the action available today, while abandonment returns it to the backlog.

The trillion-dollar GPP panel remains a symbolic scoreboard. It must not pretend
to be financial output. Inside Work, the active session or committed-step queue
must remain visually dominant.

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
- Add APIs, export/import support, cache hooks, and a committed-step execution view.
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
3. A user can write a problem, attach a step, and see it in committed steps.
4. A user can commit up to three primary steps.
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
