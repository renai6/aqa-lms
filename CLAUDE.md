# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
pnpm dev          # start dev server
pnpm build        # production build
pnpm lint         # ESLint (flat config, v9)
```

Prisma:
```bash
pnpm prisma migrate dev      # apply migrations in dev
pnpm prisma generate         # regenerate client after schema changes
pnpm prisma studio           # GUI for the database
```

## Architecture

**LMS (Learning Management System)** built on Next.js 16 App Router, React 19, TypeScript, Prisma 7, PostgreSQL, Tailwind CSS 4, and shadcn/ui.

### Domain model

The enrollment flow has two phases:
1. **Pre-enrollment**: A visitor submits an `EnrollmentRequest` (with optional payment proof). An admin approves/rejects it.
2. **Active enrollment**: On approval, a `User` account is created and an `Enrollment` record links the user to the course.

Course hierarchy: `Course → Subject → Lesson`. Assessments (Quiz or Exam) belong to a `Subject`. Questions support three types: `MULTIPLE_CHOICE`, `TRUE_FALSE`, `ESSAY`. Students submit `AssessmentAttempt`s containing `StudentAnswer`s. `Grade`s are per-subject; `Certificate`s are per-course.

User roles: `SUPER_ADMIN`, `ADMIN`, `STUDENT`. Auth is custom (bcryptjs for hashing, no NextAuth). Email is via Resend.

### Key non-obvious details

**Prisma 7**: Uses a separate `prisma.config.ts` (with `defineConfig`) instead of the datasource URL inside `schema.prisma`. The generated client outputs to `app/generated/prisma` (not `node_modules/@prisma/client`) — import from there.

**Tailwind CSS 4**: No `tailwind.config.js`. Configuration lives entirely in `app/globals.css` via `@import "tailwindcss"` and `@theme inline {}` blocks.

**Zod 4**: Installed as `zod@4`. The API has changed from v3 — do not assume v3 patterns.

**ESM**: `package.json` has `"type": "module"`. All files are ESM; avoid CommonJS patterns.

**shadcn/ui**: Style is `radix-nova`. Add components with `pnpm shadcn add <component>`. Components land in `components/ui/`.

**Path alias**: `@/` maps to the project root (not `src/`).

**User roles updated**: Schema now includes `TEACHER` role in addition to `SUPER_ADMIN`, `ADMIN`, `STUDENT`. Teachers are assigned to subjects via `SubjectTeacher` join table.

## Development Skills

| Skill | File | Invoke when... |
|-------|------|----------------|
| `generate-crud` | `.claude/skills/generate-crud/SKILL.md` | Scaffolding a new Prisma model's full vertical slice (lib + API routes + form) |

To use a skill, ask Claude to read the skill file and follow it, or say: "use the generate-crud skill to scaffold [ModelName]".
