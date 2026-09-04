#!/bin/sh
# Build pre-step that makes deploys zero-config:
#   - DATABASE_URL starts with postgres*  → use schema.postgres.prisma,
#     generate the client AND create/patch the tables in the hosted DB
#     (idempotent: second deploy onwards is a no-op).
#   - anything else (local dev) → plain sqlite generate, tables come from
#     db:push as before. Local files are never touched by the postgres path.
set -e

# Resolve the prisma CLI whether or not node_modules/.bin is on PATH
# (npm/bun run add it; direct `sh scripts/vercel-build.sh` does not).
PRISMA="prisma"
command -v prisma >/dev/null 2>&1 || PRISMA="./node_modules/.bin/prisma"

case "$DATABASE_URL" in
  postgres*)
    echo "vercel-build: Postgres DATABASE_URL detected → schema.postgres.prisma"
    "$PRISMA" generate --schema prisma/schema.postgres.prisma
    "$PRISMA" db push --schema prisma/schema.postgres.prisma --accept-data-loss --skip-generate
    ;;
  *)
    echo "vercel-build: no Postgres URL → default sqlite schema"
    "$PRISMA" generate
    ;;
esac
