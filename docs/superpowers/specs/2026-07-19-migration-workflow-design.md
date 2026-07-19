# Migration Workflow Design

Date: 2026-07-19

## Problem

Every developer runs `prisma migrate dev` against the same hosted Supabase instance that serves the real application.
There is no local development database.
`DATABASE_URL` and `DIRECT_URL` in `.env` both point at `aws-1-ap-southeast-2.pooler.supabase.com`.

This makes a destructive prompt a routine part of ordinary feature work.

### What happened on 2026-07-19

Adding `User.tokenVersion` on a branch that was 17 commits behind `main` produced this:

```
- Drift detected: Your database schema is not in sync with your migration history.

[*] Changed the `Course` table
  [+] Added column `archivedAt`
  [+] Added index on columns (archivedAt)

- The migrations recorded in the database diverge from the local migrations directory.
  Last common migration: `20260718060211_certificate_unique_user_course`.
  Migrations applied to the database but absent from the migrations directory are:
  20260718095441_add_course_archived_at

We need to reset the "public" schema at "aws-1-ap-southeast-2.pooler.supabase.com:5432"

You may use prisma migrate reset to drop the development database.
All data will be lost.
```

Nothing was wrong with the database.
The database was perfectly consistent with `origin/main`.

The branch predated the course-archiving merge, so `20260718095441_add_course_archived_at` existed in the database with no corresponding local file.
Prisma cannot distinguish "this developer is behind" from "someone tampered with the schema", so it proposed the only remedy it has, which is a reset.

The reset would have dropped the production schema to fix a stale `git checkout`.

### Why this is a recurring hazard rather than a one-off

The repository has 35 branches and merged 10 migrations in July alone.
Any branch created before a migration merges, and rebased later than that migration is applied, reproduces the prompt exactly.

The prompt is one keystroke from irreversible data loss, and it appears during a routine operation that developers run often enough to answer on autopilot.
The safety of the system currently rests on every developer reading the prompt carefully every time.

### A second, quieter failure mode

Recovering from the drift involved running `prisma migrate deploy`, which reported:

```
22 migrations found in prisma/migrations

No pending migrations to apply.
```

That output reads like success.
It is not.
`migrate deploy` only replays migration files that already exist, and the migration in question had not been generated yet, so it did nothing at all.
The schema change was silently skipped, and the mismatch would only have surfaced at runtime as a missing-column error on every authenticated page.

### Shadow database exposure

No `shadowDatabaseUrl` is configured.
`prisma migrate dev` therefore creates and drops a temporary shadow database on the hosted instance on every invocation.
This requires elevated privileges on the production host and is an additional reason `migrate dev` should never point there.

## What is already correct

The production deploy path is safe and should not change.
`vercel-build` runs `prisma generate && prisma migrate deploy && next build`.
`migrate deploy` never generates SQL, never prompts, and never resets.
It only applies committed migration files, which is exactly right for a deploy.

The problem is confined to local development.

## Decision

Give each developer a real local database, and reserve the hosted instance for deployed environments.

`migrate dev` becomes safe by construction, because the database it can destroy is disposable and local.
No amount of branch staleness can then threaten real data.
Drift prompts become informative rather than dangerous, and the correct answer to a reset prompt becomes "yes" instead of "stop and investigate".

This is the only option that removes the hazard rather than reducing its frequency.
Every alternative below leaves a path where a mistimed keystroke destroys production data.

### Rejected alternatives

**Documentation and care.**
The current situation already depends on this, and it failed.
A prompt that must be read correctly every time by every developer is not a control.

**Restricting who may run migrations.**
This concentrates the risk rather than removing it.
The person running migrations most often is the person most likely to answer the prompt from muscle memory.

**A pre-flight guard alone.**
A script that refuses to run `migrate dev` against the shared host is genuinely useful, but on its own it leaves developers with no way to author a migration at all.
It is worth adding, but as a safety net beneath the local database, not instead of it.

## Design

### Local database

Postgres runs locally via Docker Compose.
A `docker-compose.yml` at the repository root defines a single `postgres` service with a named volume.

`.env` points at it:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aqa_lms"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/aqa_lms"
```

The hosted Supabase credentials move out of `.env` entirely and live only in Vercel's environment settings.
This is a meaningful side benefit.
Today every developer's working copy holds credentials to the production database, and a stray `migrate reset` or `db push` in the wrong terminal is sufficient to destroy it.

Bootstrapping a fresh checkout becomes:

```
docker compose up -d
pnpm prisma migrate deploy
pnpm prisma db seed
```

`prisma/seed.ts` already exists and provisions an admin from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, so a usable local environment is one command away.

### Seed data realism

The seed script currently creates only an admin user.
Local development against an empty database will not surface issues that appear with real course, enrollment, and purchase data.

This is the main cost of the change, and it should be acknowledged rather than glossed over.
Developers currently get realistic data for free by sharing the production database.

The mitigation is to extend `prisma/seed.ts` to build a representative fixture set: a few courses across both `CourseType` values, subjects with and without gender restrictions, a batch, and enrollments in each `PaymentStatus`.
This is worth doing on its own merits, because it makes local reproduction of reported bugs possible without touching production data.

### Guard against the shared host

A pre-flight check makes the dangerous case impossible to reach by accident.
`scripts/check-db-target.ts` exits non-zero when `DIRECT_URL` points at a non-local host, and the migration scripts run it first:

```json
"db:migrate": "tsx scripts/check-db-target.ts && prisma migrate dev",
"db:reset": "tsx scripts/check-db-target.ts && prisma migrate reset"
```

Developers run `pnpm db:migrate` rather than `pnpm prisma migrate dev`.
The guard is deliberately dumb: it compares the host against an allowlist of `localhost` and `127.0.0.1`, and it can be overridden with an explicit environment variable for the rare case of intentionally targeting a remote environment.

An escape hatch that must be typed deliberately is the point.
The failure mode being prevented is an accidental keystroke, not a determined operator.

### Staging

Migrations reach the hosted database only through a deploy.
`migrate deploy` on Vercel already does this, and no developer needs write access to production schema from their laptop.

If a migration needs validating against production-like data before release, that belongs in a staging Supabase project restored from a production backup, not in developers running `migrate dev` against production.
This is out of scope here, but the local-database change is a prerequisite for it.

## Consequences

Developers must run Docker locally, which is a real ergonomic cost on machines where it is not already running.

Local databases drift from production in content, though no longer in schema.
Schema stays synchronized because migrations are the only mechanism that changes it.

Bugs that depend on production data volume or specific production rows become harder to reproduce locally.
This is the honest tradeoff, and the seed-data work above is what keeps it manageable.

In exchange, no routine development operation can destroy production data, and the production credentials stop living in every working copy.

## Open questions

Whether to adopt Supabase's branching feature instead of local Docker.
It would keep the managed-Postgres parity that local Docker gives up, but it ties development to a paid platform feature and still puts a remote database behind `migrate dev`.
Worth evaluating before committing to Docker, but the local database is the safer default.

How to seed realistic data without copying personal information out of production.
Enrollments and purchases contain real student names, contact numbers, and payment proofs.
Any production-derived fixture must be anonymized, which argues for synthetic seed data instead.
