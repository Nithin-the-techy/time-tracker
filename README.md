# Operations

A private, single-user execution and time-accounting application built with Next.js, Prisma, and PostgreSQL.

## Start here

- Agent and contribution rules: [AGENTS.md](AGENTS.md)
- Product contract: [docs/GOAL_ENGINE_SPEC.md](docs/GOAL_ENGINE_SPEC.md)
- Production deployment: [VERCEL.md](VERCEL.md)

The outer repository is the canonical application. The nested `time-tracker/`
directory is a preserved legacy snapshot and must not be used for current work.

## Product structure

- **Progress** is the first/default tab for GPP and time composition.
- **Work** is the second tab and follows `Sprint → Outcome → Step → Session`.
- **History** is the canonical time ledger.
- **Settings** owns configuration, rivals, and backup/import.

## Local validation

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Local development uses:

```bash
pnpm dev
```

Do not commit `.env`, database credentials, passwords, or deployment tokens.
