# Production deployment

## Canonical destination

- GitHub: `Nithin-the-techy/time-tracker`
- Production branch: `main`
- Vercel project: `time-tracker`
- Stable URL: <https://time-tracker-nithin-a276.vercel.app/>
- Database: managed PostgreSQL configured through `DATABASE_URL`

The Vercel project is already connected and configured. Do not create a second
project, database, or production URL for ordinary releases.

## Required environment variables

- `DATABASE_URL`
- `APP_PASSWORD`
- `AUTH_SECRET` of at least 32 characters

Read or modify values only when the task requires it. Never print them in
reports, write them to tracked files, or place tokens in remote URLs.

## Release workflow

1. Confirm the outer repository is active and `git status` contains no
   unexplained changes.
2. Run typecheck, focused lint, tests, and the production build.
3. Commit the intended diff and push that commit to GitHub `main`.
4. Let the existing GitHub integration deploy, or trigger this existing Vercel
   project explicitly when required.
5. Verify:
   - local commit equals remote `main`;
   - Vercel reports `READY` for that exact commit;
   - the stable alias targets that deployment;
   - the public endpoint returns successfully without a Vercel sign-in wall;
   - a cache-busted authenticated browser load shows a visible acceptance
     marker from the release.

Do not report “deployed” based only on a successful push or a Vercel
`READY` state.

## Database safety

- Production builds generate Prisma clients; they must not perform destructive
  schema resets.
- Export a JSON backup before a material schema migration.
- Apply reviewed migrations separately from normal application compilation.
- Never use `db push --accept-data-loss` against production.

## Troubleshooting

- **Stable URL looks unchanged:** compare deployment commit SHA with remote
  `main`, then load `?release=<short-commit>` or hard-refresh. Confirm a
  visible release-specific label or behavior after authentication.
- **Vercel login wall appears:** inspect project deployment protection. Do not
  confuse it with the application's own `APP_PASSWORD` login.
- **Application says “Wrong password”:** inspect the production
  `APP_PASSWORD` configuration and redeploy after an authorized change.
- **Build cannot reach PostgreSQL:** verify the production
  `DATABASE_URL` is the complete pooled TLS connection string.
- **Sessions suddenly expire:** changing `AUTH_SECRET` invalidates existing
  login cookies.

The nested `time-tracker/VERCEL.md` belongs to the legacy snapshot and is not
current documentation.
