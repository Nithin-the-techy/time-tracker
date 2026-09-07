# TimeTracker / Operations project instructions

This is the canonical active application at `C:\Users\nithi\OneDrive\Codex\workspace\projects\time-tracker`.

## Sources of truth

- Product contract: `docs/GOAL_ENGINE_SPEC.md`
- Current application code: outer repository root
- Deployment operations: `VERCEL.md`
- Historical audit and superseded proposals: `..\..\common\time-tracker\`
- The nested `time-tracker\` directory is a tracked legacy snapshot. Do not edit or run it for current work.

When direct user feedback conflicts with an older audit or proposal, update the product contract and follow the newer decision.

## Product contract

- Progress is the first tab and default landing view.
- Work is the second tab and owns planning plus execution.
- The Work hierarchy is `Sprint → Outcome → Step → Session`. Use these nouns consistently in interface copy.
- The active Sprint scopes the primary committed-step queue. Show at most three committed steps. Clearly separate work outside the Sprint.
- A completed session requires one line of proof. Label it required before submission; interruption or backlog recovery may omit it.
- Goal-directed sessions create or link to canonical time logs. General logs may exist without a goal. Do not create competing records for the same work.
- Sprints are universal and user-created. Never hard-code Nithin's current subjects, deadlines, hours, or personal targets into normal defaults.
- Preserve Progress, History, Settings, export/import, authentication, and existing data unless removal is explicitly approved.

## Interface system: Quiet Ledger

- Preserve the navy ink, paper surface, gold growth, red loss, Fraunces display, and IBM Plex Sans body identity.
- Reserve serif for page titles and large numeric metrics.
- Give each screen one Tier-1 region. Recede context and management through size, placement, menus, dialogs, or collapsed sections.
- Use shared row and panel primitives. Avoid stacks of equally weighted cards and decorative numbering for parallel choices.
- Gold means positive/on pace, red means negative/at risk, and gray means neutral/not started.
- Interface copy is concise, active, sentence case, and consistent with API behavior.

## Workflow before changing the product

For a substantial change, write down the following before implementation and ask at most three questions if any material answer is missing:

1. The user loop and primary screen.
2. Navigation order and default landing view.
3. Concepts, names, and relationships.
4. Existing capabilities and data that must remain.
5. Empty, active, error, recovery, and mobile states.
6. Acceptance checks and deployment destination.

If the user explicitly asks to plan first, do not edit product code, schema, production data, or deployment until the proposal is approved.

## Verification and deployment

- Inspect `git status`, the active branch, and remote before editing or replacing files.
- Do not delete the repository or database to “start fresh” without resolving the exact target and confirming preservation requirements.
- Run typecheck, focused lint, tests, and a production build for product changes.
- For UI changes, inspect the authenticated page at desktop and mobile sizes when tooling permits. If it does not, disclose that gap.
- Production is GitHub `main` deployed to the existing Vercel project and stable alias documented in `VERCEL.md`.
- Before saying “updated,” verify local commit = remote `main` = Vercel deployment commit, then verify the stable alias with a cache-busted load and a visible acceptance marker.
- Never commit tokens, database URLs, passwords, or decrypted environment values.
