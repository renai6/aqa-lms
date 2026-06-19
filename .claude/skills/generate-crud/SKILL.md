---
name: generate-crud
description: Use when asked to generate, scaffold, or create CRUD operations for a Prisma model in the aqa-lms project — produces lib query functions, API routes, Zod validation schema, and a shadcn form component.
---

# CRUD Generator

## Overview

Generates a full vertical slice for a given Prisma model. Always read the schema and any existing routes before writing anything.

## Step 1 — Read First

Before generating any code:

1. Read `prisma/schema.prisma` — identify the target model's fields, types, relations, and which fields are optional
2. Check for an existing `lib/db.ts` — if absent, create the Prisma singleton first (see below)
3. Read an existing route (e.g. `app/api/courses/route.ts`) if one exists — match its style
4. Check `node_modules/next/dist/docs/` for App Router route handler conventions — Next.js 16 has breaking changes from training data

## Step 2 — Files to Generate

| File | Purpose |
|------|---------|
| `lib/db.ts` | Prisma singleton (create once, reuse everywhere) |
| `lib/[models].ts` | Typed query functions — server-only |
| `lib/validations/[model].ts` | Zod v4 schemas + inferred types |
| `app/api/[models]/route.ts` | Collection: GET (list) + POST (create) |
| `app/api/[models]/[id]/route.ts` | Item: GET + PUT + DELETE |
| `components/[models]/[model]-form.tsx` | shadcn form wired to react-hook-form |

Use the plural kebab-case model name for directories (`courses`, `assessment-attempts`).

## Prisma Singleton (`lib/db.ts`)

This project uses `@prisma/adapter-pg`. Create once if absent:

```ts
import "server-only"
import { PrismaClient } from "@/app/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const db =
  globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
```

**Never** import from `@prisma/client` — the generated client is at `@/app/generated/prisma`.

## Lib Layer (`lib/[models].ts`)

```ts
import "server-only"
import { db } from "@/lib/db"
import type { Create[Model]Input, Update[Model]Input } from "@/lib/validations/[model]"

export async function get[Models]() {
  return db.[model].findMany({ orderBy: { createdAt: "desc" } })
}

export async function get[Model](id: string) {
  return db.[model].findUnique({ where: { id } })
}

export async function create[Model](data: Create[Model]Input) {
  return db.[model].create({ data })
}

export async function update[Model](id: string, data: Update[Model]Input) {
  return db.[model].update({ where: { id }, data })
}

export async function delete[Model](id: string) {
  return db.[model].delete({ where: { id } })
}
```

## Zod Validation (`lib/validations/[model].ts`)

This project uses **Zod v4** — do not use deprecated v3 patterns.

```ts
import { z } from "zod"

export const create[Model]Schema = z.object({
  // Required String   → z.string().min(1)
  // Optional String   → z.string().min(1).optional()
  // Required Int      → z.number().int()
  // Optional Float    → z.number().optional()
  // Enum              → z.enum(["A", "B"])
  // Boolean           → z.boolean()
})

export const update[Model]Schema = create[Model]Schema.partial()

export type Create[Model]Input = z.infer<typeof create[Model]Schema>
export type Update[Model]Input = z.infer<typeof update[Model]Schema>
```

Omit from schema: `id`, `createdAt`, `updatedAt`, computed fields, and relation IDs that are set server-side.

## API Routes

Read `node_modules/next/dist/docs/` for exact route handler types before writing. The pattern below is approximate — verify param types for Next.js 16:

```ts
// app/api/[models]/route.ts
import { get[Models], create[Model] } from "@/lib/[models]"
import { create[Model]Schema } from "@/lib/validations/[model]"

export async function GET() {
  const items = await get[Models]()
  return Response.json(items)
}

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = create[Model]Schema.safeParse(body)
  if (!parsed.success) return Response.json(parsed.error, { status: 400 })
  const item = await create[Model](parsed.data)
  return Response.json(item, { status: 201 })
}
```

```ts
// app/api/[models]/[id]/route.ts — verify RouteContext type for Next.js 16
export async function GET(_req: Request, { params }: { params: { id: string } }) { ... }
export async function PUT(_req: Request, { params }: { params: { id: string } }) { ... }
export async function DELETE(_req: Request, { params }: { params: { id: string } }) { ... }
```

## Form Component

Requires `@hookform/resolvers` — install if absent:
```bash
pnpm add @hookform/resolvers
```

```tsx
"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { create[Model]Schema, type Create[Model]Input } from "@/lib/validations/[model]"

export function [Model]Form() {
  const form = useForm<Create[Model]Input>({
    resolver: zodResolver(create[Model]Schema),
    defaultValues: { /* sensible defaults */ },
  })

  async function onSubmit(data: Create[Model]Input) {
    await fetch("/api/[models]", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField control={form.control} name="[field]" render={({ field }) => (
          <FormItem>
            <FormLabel>[Label]</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
```

Map field types to shadcn components: `String` → `Input`, `Boolean` → `Switch`, `enum` → `Select`, `Int/Float` → `Input type="number"`.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `import { PrismaClient } from "@prisma/client"` | Import from `"@/app/generated/prisma"` |
| Using `z.string().nullable()` with v3 mindset | Check Zod v4 docs — null/optional behavior changed |
| Forgetting `"use client"` on form component | Add as first line |
| Forgetting `import "server-only"` in lib files | Add as first line |
| Instantiating `new PrismaClient()` directly in lib | Import `db` from `@/lib/db` |
| Assuming Next.js 15 route handler types | Verify against `node_modules/next/dist/docs/` |
