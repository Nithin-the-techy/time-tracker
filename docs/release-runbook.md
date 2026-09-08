# Operations release runbook

The application build deliberately does not mutate the production database. A
release that changes the Prisma schema is a two-part operation:

1. Authenticate to the app, export a full JSON backup from Settings → Backup,
   and keep that file outside the repository.
2. Review the duplicate `SprintGoal.goalId` query before applying the reviewed
   operations migration. For a legacy database that has no `_prisma_migrations`
   table, execute that SQL once with `prisma db execute`, then register it with
   `prisma migrate resolve --applied 20260908_operations_truth`. This is the
   compatibility bridge for the historical `db push` database; do not use
   `db push` for the release.
3. On a fresh database, apply `00000000000000_baseline` followed by
   `20260908_operations_truth` with `pnpm db:deploy:pg`.
4. For later schema additions, apply each reviewed migration after the backup;
   the current blocker archive migration is `20260908_blocker_archive`.
5. Confirm the migration and deployment health, then run the critical
   Sprint → Outcome → Step → Session → History flow with a cache-busting query.

Never commit `DATABASE_URL`, `APP_PASSWORD`, `AUTH_SECRET`, or access tokens.
The migration adds nullable category/deletion metadata, the workspace timezone
singleton, and the one-Sprint-per-Outcome uniqueness index. Apply the
migration before switching production traffic to this commit: the bootstrap
now reads the workspace preference, so an old production schema is not a
supported compatibility state.
