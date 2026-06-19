# Authentication & Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement custom JWT-based authentication with role-based routing for SUPER_ADMIN, ADMIN, TEACHER, and STUDENT roles, including email verification and password reset.

**Architecture:** Next.js middleware verifies JWTs on every request and forwards `x-user-id` / `x-user-role` headers to server components. Auth utilities are split into Edge-safe (`lib/auth/jwt.ts`) and server-only (`lib/auth/session.ts`) modules. Pages use React 19 `useActionState` with server actions.

**Tech Stack:** `jose` (JWT), `bcryptjs` (password hashing), `resend` v6 (email), `next/headers` (cookies + headers), `vitest` (tests), Prisma 7 + `@prisma/adapter-pg` (DB)

---

## File Map

| File | Created/Modified | Purpose |
|---|---|---|
| `vitest.config.ts` | Create | Vitest config with `@/` alias |
| `prisma/schema.prisma` | Modify | Add `TokenType` enum + `VerificationToken` model |
| `lib/db.ts` | Create | Singleton Prisma client with pg adapter |
| `lib/auth/types.ts` | Create | `UserRole` string union + `SessionPayload` type (Edge-safe) |
| `lib/auth/password.ts` | Create | `hashPassword`, `comparePassword` wrappers over bcryptjs |
| `lib/auth/jwt.ts` | Create | `signToken`, `verifySessionToken` — Edge-safe, no next/ imports |
| `lib/auth/tokens.ts` | Create | `createVerificationToken`, `verifyAndConsumeToken` |
| `lib/auth/email.ts` | Create | `sendVerificationEmail`, `sendPasswordResetEmail` via Resend |
| `lib/auth/session.ts` | Create | `createSession`, `clearSession`, `getSession` — server-only |
| `middleware.ts` | Create | JWT verify, role routing, header forwarding |
| `prisma/seed.ts` | Create | Idempotent SUPER_ADMIN seeder |
| `package.json` | Modify | Add `test` script, `prisma.seed` config |
| `app/(auth)/layout.tsx` | Create | Centered auth page wrapper |
| `app/(auth)/login/page.tsx` | Create | Login form (client component) |
| `app/(auth)/login/actions.ts` | Create | `loginAction` server action |
| `app/(auth)/forgot-password/page.tsx` | Create | Forgot password form |
| `app/(auth)/forgot-password/actions.ts` | Create | `forgotPasswordAction` server action |
| `app/(auth)/reset-password/page.tsx` | Create | Server component — reads token from searchParams |
| `app/(auth)/reset-password/reset-password-form.tsx` | Create | Client form for setting new password |
| `app/(auth)/reset-password/actions.ts` | Create | `resetPasswordAction` server action |
| `app/(auth)/verify-email/page.tsx` | Create | Server component — verifies token on load |
| `app/api/auth/logout/route.ts` | Create | Clears session cookie |
| `app/(admin)/layout.tsx` | Create | Reads session, makes user available to children |
| `app/(admin)/dashboard/page.tsx` | Create | Placeholder admin dashboard |
| `app/(teacher)/layout.tsx` | Create | Reads session, makes user available to children |
| `app/(teacher)/dashboard/page.tsx` | Create | Placeholder teacher dashboard |
| `app/(student)/layout.tsx` | Create | Reads session, makes user available to children |
| `app/(student)/dashboard/page.tsx` | Create | Placeholder student dashboard |
| `lib/__tests__/auth/password.test.ts` | Create | Unit tests for password helpers |
| `lib/__tests__/auth/jwt.test.ts` | Create | Unit tests for JWT sign/verify |
| `lib/__tests__/auth/tokens.test.ts` | Create | Tests for token create/consume (Prisma mocked) |
| `lib/__tests__/auth/email.test.ts` | Create | Tests for email send (Resend mocked) |
| `lib/__tests__/auth/middleware.test.ts` | Create | Tests for middleware routing logic |

---

## Task 1: Install Dependencies + Vitest Config

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install runtime dependency**

```bash
pnpm add jose
```

- [ ] **Step 2: Install test dependencies**

```bash
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 4: Add test script and prisma seed config to `package.json`**

Add `"test": "vitest"` to the `scripts` block and a top-level `"prisma"` block:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 5: Verify Vitest runs**

```bash
pnpm test -- --run
```

Expected: `No test files found` (zero tests is fine — no error)

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml
git commit -m "chore: add jose + vitest test infrastructure"
```

---

## Task 2: Schema Additions + Migration + DB Client

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/db.ts`

- [ ] **Step 1: Add `TokenType` enum and `VerificationToken` model to `prisma/schema.prisma`**

After the existing enums block, add:

```prisma
enum TokenType {
  EMAIL_VERIFICATION
  PASSWORD_RESET
}
```

After the `User` model's relations, add `verificationTokens VerificationToken[]` to the `User` model:

```prisma
model User {
  // ... existing fields ...
  verificationTokens VerificationToken[]
}
```

Add the `VerificationToken` model after the `User` model:

```prisma
model VerificationToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  token     String    @unique
  type      TokenType
  expiresAt DateTime
  createdAt DateTime  @default(now())
}
```

- [ ] **Step 2: Run migration**

```bash
pnpm prisma migrate dev --name add_verification_token
```

Expected: Migration created and applied, Prisma client regenerated.

- [ ] **Step 3: Regenerate client (in case migrate dev didn't)**

```bash
pnpm prisma generate
```

- [ ] **Step 4: Create `lib/db.ts`**

```typescript
import { PrismaClient } from '@/app/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/db.ts
git commit -m "feat: add VerificationToken schema + Prisma db client"
```

---

## Task 3: Auth Types + Password Helpers (TDD)

**Files:**
- Create: `lib/auth/types.ts`
- Create: `lib/auth/password.ts`
- Create: `lib/__tests__/auth/password.test.ts`

- [ ] **Step 1: Create `lib/auth/types.ts`**

```typescript
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT'

export type SessionPayload = {
  sub: string
  role: UserRole
  email: string
}
```

- [ ] **Step 2: Write failing tests at `lib/__tests__/auth/password.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { hashPassword, comparePassword } from '@/lib/auth/password'

describe('hashPassword', () => {
  it('returns a string different from the input', async () => {
    const hash = await hashPassword('secret123')
    expect(hash).not.toBe('secret123')
    expect(typeof hash).toBe('string')
  })

  it('produces different hashes for the same input (salt)', async () => {
    const a = await hashPassword('secret123')
    const b = await hashPassword('secret123')
    expect(a).not.toBe(b)
  })
})

describe('comparePassword', () => {
  it('returns true when password matches hash', async () => {
    const hash = await hashPassword('secret123')
    expect(await comparePassword('secret123', hash)).toBe(true)
  })

  it('returns false when password does not match hash', async () => {
    const hash = await hashPassword('secret123')
    expect(await comparePassword('wrongpassword', hash)).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests — confirm they fail**

```bash
pnpm exec vitest run lib/__tests__/auth/password.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/auth/password'`

- [ ] **Step 4: Create `lib/auth/password.ts`**

```typescript
import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
pnpm exec vitest run lib/__tests__/auth/password.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/auth/types.ts lib/auth/password.ts lib/__tests__/auth/password.test.ts
git commit -m "feat: add auth types and password hash/compare helpers"
```

---

## Task 4: JWT Sign + Verify (TDD)

**Files:**
- Create: `lib/auth/jwt.ts`
- Create: `lib/__tests__/auth/jwt.test.ts`

- [ ] **Step 1: Write failing tests at `lib/__tests__/auth/jwt.test.ts`**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { signToken, verifySessionToken } from '@/lib/auth/jwt'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-characters!!'
})

describe('signToken + verifySessionToken', () => {
  it('produces a token that verifies successfully', async () => {
    const payload = { sub: 'user-1', role: 'STUDENT' as const, email: 'student@test.com' }
    const token = await signToken(payload)
    const result = await verifySessionToken(token)
    expect(result?.sub).toBe('user-1')
    expect(result?.role).toBe('STUDENT')
    expect(result?.email).toBe('student@test.com')
  })

  it('returns null for a tampered token', async () => {
    const result = await verifySessionToken('totally.invalid.token')
    expect(result).toBeNull()
  })

  it('returns null for empty string', async () => {
    const result = await verifySessionToken('')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pnpm exec vitest run lib/__tests__/auth/jwt.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/auth/jwt'`

- [ ] **Step 3: Create `lib/auth/jwt.ts`**

```typescript
import { SignJWT, jwtVerify } from 'jose'
import type { SessionPayload } from './types'

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!)
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pnpm exec vitest run lib/__tests__/auth/jwt.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/auth/jwt.ts lib/__tests__/auth/jwt.test.ts
git commit -m "feat: add Edge-safe JWT sign/verify"
```

---

## Task 5: Verification Tokens (TDD with Prisma Mock)

**Files:**
- Create: `lib/auth/tokens.ts`
- Create: `lib/__tests__/auth/tokens.test.ts`

- [ ] **Step 1: Write failing tests at `lib/__tests__/auth/tokens.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    verificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { createVerificationToken, verifyAndConsumeToken } from '@/lib/auth/tokens'

describe('createVerificationToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a DB record with the correct userId and type', async () => {
    vi.mocked(db.verificationToken.create).mockResolvedValue({} as any)

    const token = await createVerificationToken('user-1', 'EMAIL_VERIFICATION')

    expect(typeof token).toBe('string')
    expect(token.length).toBe(64) // 32 bytes → 64 hex chars
    expect(db.verificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'EMAIL_VERIFICATION',
        }),
      })
    )
  })
})

describe('verifyAndConsumeToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no record is found', async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue(null)
    const result = await verifyAndConsumeToken('no-token', 'EMAIL_VERIFICATION')
    expect(result).toBeNull()
  })

  it('returns null when token type does not match', async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      id: '1', userId: 'user-1', token: 'abc', type: 'PASSWORD_RESET',
      expiresAt: new Date(Date.now() + 3600000), createdAt: new Date(), user: {} as any,
    } as any)
    const result = await verifyAndConsumeToken('abc', 'EMAIL_VERIFICATION')
    expect(result).toBeNull()
  })

  it('returns null when token is expired', async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      id: '1', userId: 'user-1', token: 'abc', type: 'EMAIL_VERIFICATION',
      expiresAt: new Date(Date.now() - 1000), createdAt: new Date(), user: {} as any,
    } as any)
    const result = await verifyAndConsumeToken('abc', 'EMAIL_VERIFICATION')
    expect(result).toBeNull()
  })

  it('returns userId and deletes the record when valid', async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      id: '1', userId: 'user-1', token: 'abc', type: 'EMAIL_VERIFICATION',
      expiresAt: new Date(Date.now() + 3600000), createdAt: new Date(), user: {} as any,
    } as any)
    vi.mocked(db.verificationToken.delete).mockResolvedValue({} as any)

    const result = await verifyAndConsumeToken('abc', 'EMAIL_VERIFICATION')

    expect(result).toBe('user-1')
    expect(db.verificationToken.delete).toHaveBeenCalledWith({ where: { token: 'abc' } })
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pnpm exec vitest run lib/__tests__/auth/tokens.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/auth/tokens'`

- [ ] **Step 3: Create `lib/auth/tokens.ts`**

```typescript
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import type { TokenType } from '@/app/generated/prisma'

const TOKEN_EXPIRY_MS: Record<string, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
}

export async function createVerificationToken(userId: string, type: TokenType): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS[type])
  await db.verificationToken.create({ data: { userId, token, type, expiresAt } })
  return token
}

export async function verifyAndConsumeToken(token: string, type: TokenType): Promise<string | null> {
  const record = await db.verificationToken.findUnique({ where: { token } })
  if (!record || record.type !== type || record.expiresAt < new Date()) return null
  await db.verificationToken.delete({ where: { token } })
  return record.userId
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pnpm exec vitest run lib/__tests__/auth/tokens.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/auth/tokens.ts lib/__tests__/auth/tokens.test.ts
git commit -m "feat: add verification token create/consume"
```

---

## Task 6: Email Helpers + Session (Server-Only)

**Files:**
- Create: `lib/auth/email.ts`
- Create: `lib/__tests__/auth/email.test.ts`
- Create: `lib/auth/session.ts`

- [ ] **Step 1: Write test for email helpers at `lib/__tests__/auth/email.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null }) },
  })),
}))

beforeEach(() => {
  process.env.RESEND_FROM_EMAIL = 'noreply@test.com'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/auth/email'

describe('sendVerificationEmail', () => {
  it('calls resend.emails.send without throwing', async () => {
    await expect(sendVerificationEmail('user@test.com', 'token-abc')).resolves.not.toThrow()
  })
})

describe('sendPasswordResetEmail', () => {
  it('calls resend.emails.send without throwing', async () => {
    await expect(sendPasswordResetEmail('user@test.com', 'token-xyz')).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pnpm exec vitest run lib/__tests__/auth/email.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/auth/email'`

- [ ] **Step 3: Create `lib/auth/email.ts`**

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: 'Verify your email — AQA LMS',
    html: `<p>Click <a href="${url}">here</a> to verify your email. Link expires in 24 hours.</p>`,
  })
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: 'Reset your password — AQA LMS',
    html: `<p>Click <a href="${url}">here</a> to reset your password. Link expires in 1 hour.</p>`,
  })
}
```

- [ ] **Step 4: Run email tests — confirm they pass**

```bash
pnpm exec vitest run lib/__tests__/auth/email.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Create `lib/auth/session.ts`**

This file uses `next/headers` (server-only — do NOT import from middleware).

```typescript
import { cookies, headers } from 'next/headers'
import { signToken } from './jwt'
import type { UserRole } from './types'

export async function createSession(user: { id: string; role: UserRole; email: string }) {
  const token = await signToken({ sub: user.id, role: user.role, email: user.email })
  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

export async function getSession(): Promise<{ userId: string; role: UserRole } | null> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  const role = headersList.get('x-user-role') as UserRole | null
  if (!userId || !role) return null
  return { userId, role }
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/auth/email.ts lib/auth/session.ts lib/__tests__/auth/email.test.ts
git commit -m "feat: add email helpers and server-only session management"
```

---

## Task 7: Middleware (with Tests)

**Files:**
- Create: `middleware.ts`
- Create: `lib/__tests__/auth/middleware.test.ts`

- [ ] **Step 1: Write failing tests at `lib/__tests__/auth/middleware.test.ts`**

```typescript
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/jwt', () => ({
  verifySessionToken: vi.fn(),
}))

import { verifySessionToken } from '@/lib/auth/jwt'
import { middleware } from '@/middleware'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-characters!!'
})

function makeRequest(path: string, sessionToken?: string) {
  const url = `http://localhost${path}`
  const req = new NextRequest(url)
  if (sessionToken) req.cookies.set('session', sessionToken)
  return req
}

describe('middleware', () => {
  it('redirects unauthenticated request on /admin to /login', async () => {
    vi.mocked(verifySessionToken).mockResolvedValue(null)
    const res = await middleware(makeRequest('/admin/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('redirects authenticated STUDENT visiting /admin to /student/dashboard', async () => {
    vi.mocked(verifySessionToken).mockResolvedValue({
      sub: 'u1', role: 'STUDENT', email: 'x@x.com',
    })
    const res = await middleware(makeRequest('/admin/dashboard', 'some-token'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/student/dashboard')
  })

  it('forwards user headers for valid ADMIN on /admin', async () => {
    vi.mocked(verifySessionToken).mockResolvedValue({
      sub: 'u2', role: 'ADMIN', email: 'admin@x.com',
    })
    const res = await middleware(makeRequest('/admin/dashboard', 'valid-token'))
    expect(res.headers.get('x-user-id')).toBe('u2')
    expect(res.headers.get('x-user-role')).toBe('ADMIN')
  })

  it('redirects authenticated user away from /login to their dashboard', async () => {
    vi.mocked(verifySessionToken).mockResolvedValue({
      sub: 'u3', role: 'TEACHER', email: 't@x.com',
    })
    const res = await middleware(makeRequest('/login', 'valid-token'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/teacher/dashboard')
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pnpm exec vitest run lib/__tests__/auth/middleware.test.ts
```

Expected: FAIL — `Cannot find module '@/middleware'`

- [ ] **Step 3: Create `middleware.ts` at project root**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth/jwt'
import type { UserRole } from '@/lib/auth/types'

const ROLE_DASHBOARDS: Record<UserRole, string> = {
  SUPER_ADMIN: '/admin/dashboard',
  ADMIN: '/admin/dashboard',
  TEACHER: '/teacher/dashboard',
  STUDENT: '/student/dashboard',
}

const PROTECTED: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: '/admin', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { prefix: '/teacher', roles: ['TEACHER'] },
  { prefix: '/student', roles: ['STUDENT'] },
]

const AUTH_PATHS = ['/login', '/forgot-password', '/reset-password', '/verify-email']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('session')?.value
  const payload = token ? await verifySessionToken(token) : null

  if (AUTH_PATHS.some((p) => pathname.startsWith(p)) && payload) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARDS[payload.role], request.url))
  }

  const match = PROTECTED.find((p) => pathname.startsWith(p.prefix))
  if (!match) return NextResponse.next()

  if (!payload) {
    const res = NextResponse.redirect(new URL('/login', request.url))
    res.cookies.delete('session')
    return res
  }

  if (!match.roles.includes(payload.role)) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARDS[payload.role], request.url))
  }

  const res = NextResponse.next()
  res.headers.set('x-user-id', payload.sub)
  res.headers.set('x-user-role', payload.role)
  return res
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/teacher/:path*',
    '/student/:path*',
    '/login',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ],
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pnpm exec vitest run lib/__tests__/auth/middleware.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Run full test suite**

```bash
pnpm test -- --run
```

Expected: All tests pass (14 total across all test files)

- [ ] **Step 6: Commit**

```bash
git add middleware.ts lib/__tests__/auth/middleware.test.ts
git commit -m "feat: add JWT middleware with role-based routing"
```

---

## Task 8: Seed Script

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Create `prisma/seed.ts`**

```typescript
import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/index.js'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

async function main() {
  const existing = await db.user.findFirst({ where: { role: 'SUPER_ADMIN' } })
  if (existing) {
    console.log('Super admin already exists — skipping.')
    return
  }

  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env')
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await db.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  })

  console.log(`Created super admin: ${email}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
```

- [ ] **Step 2: Add required env vars to `.env.local`**

Add these to your `.env.local` (create if it doesn't exist):

```
DATABASE_URL=postgresql://...        # runtime connection (used by PrismaPg adapter)
DIRECT_URL=postgresql://...          # direct connection for migrations (used by prisma.config.ts)
JWT_SECRET=<at-least-32-random-chars>
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=changeme123
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`DATABASE_URL` and `DIRECT_URL` can be the same connection string in local dev.

- [ ] **Step 3: Run the seed**

```bash
pnpm prisma db seed
```

Expected output:
```
Created super admin: admin@example.com
```

Run it again to verify idempotency:
```bash
pnpm prisma db seed
```

Expected output:
```
Super admin already exists — skipping.
```

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: add idempotent super admin seed script"
```

---

## Task 9: Install shadcn Components + Auth Layout

**Files:**
- Create: `app/(auth)/layout.tsx`

- [ ] **Step 1: Add required shadcn components**

```bash
pnpm shadcn add button input label card
```

Expected: Components installed to `components/ui/`

- [ ] **Step 2: Create `app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Verify layout is correct**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add components/ app/"(auth)"/layout.tsx
git commit -m "feat: add shadcn components and auth layout"
```

---

## Task 10: Login Page + Action + Logout Route

**Files:**
- Create: `app/(auth)/login/actions.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/api/auth/logout/route.ts`

- [ ] **Step 1: Create `app/(auth)/login/actions.ts`**

```typescript
'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { comparePassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import type { UserRole } from '@/lib/auth/types'

type LoginState = { error: string | null }

const DASHBOARDS: Record<UserRole, string> = {
  SUPER_ADMIN: '/admin/dashboard',
  ADMIN: '/admin/dashboard',
  TEACHER: '/teacher/dashboard',
  STUDENT: '/student/dashboard',
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get('email') as string).trim().toLowerCase()
  const password = formData.get('password') as string

  const user = await db.user.findUnique({ where: { email } })

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return { error: 'Invalid email or password.' }
  }

  if (!user.isActive) {
    return { error: 'Account not verified. Check your email for a verification link.' }
  }

  await createSession({ id: user.id, role: user.role, email: user.email })
  redirect(DASHBOARDS[user.role])
}
```

- [ ] **Step 2: Create `app/(auth)/login/page.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { loginAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'

export default function LoginPage() {
  const [state, action, isPending] = useActionState(loginAction, { error: null })

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Enter your credentials to access AQA LMS.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/forgot-password" className="underline underline-offset-4">
              Forgot password?
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Create `app/api/auth/logout/route.ts`**

```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  await clearSession()
  return NextResponse.redirect(new URL('/login', request.url))
}
```

- [ ] **Step 4: Build to verify no type errors**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/"(auth)"/login/ app/api/auth/logout/
git commit -m "feat: add login page, server action, and logout route"
```

---

## Task 11: Forgot + Reset Password Pages

**Files:**
- Create: `app/(auth)/forgot-password/actions.ts`
- Create: `app/(auth)/forgot-password/page.tsx`
- Create: `app/(auth)/reset-password/actions.ts`
- Create: `app/(auth)/reset-password/reset-password-form.tsx`
- Create: `app/(auth)/reset-password/page.tsx`

- [ ] **Step 1: Create `app/(auth)/forgot-password/actions.ts`**

```typescript
'use server'

import { db } from '@/lib/db'
import { createVerificationToken } from '@/lib/auth/tokens'
import { sendPasswordResetEmail } from '@/lib/auth/email'
import { TokenType } from '@/app/generated/prisma'

type ForgotState = { submitted: boolean }

export async function forgotPasswordAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = (formData.get('email') as string).trim().toLowerCase()
  const user = await db.user.findUnique({ where: { email } })

  if (user) {
    const token = await createVerificationToken(user.id, TokenType.PASSWORD_RESET)
    await sendPasswordResetEmail(email, token)
  }
  // Always return the same state (prevents email enumeration)
  return { submitted: true }
}
```

- [ ] **Step 2: Create `app/(auth)/forgot-password/page.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { forgotPasswordAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'

export default function ForgotPasswordPage() {
  const [state, action, isPending] = useActionState(forgotPasswordAction, { submitted: false })

  if (state.submitted) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If an account exists for that email, a reset link has been sent.
          </p>
          <p className="mt-4 text-center text-sm">
            <Link href="/login" className="underline underline-offset-4">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>Enter your email to receive a reset link.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Sending…' : 'Send reset link'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="underline underline-offset-4">Back to sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Create `app/(auth)/reset-password/actions.ts`**

```typescript
'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { verifyAndConsumeToken } from '@/lib/auth/tokens'
import { hashPassword } from '@/lib/auth/password'
import { TokenType } from '@/app/generated/prisma'

type ResetState = { error: string | null }

export async function resetPasswordAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = formData.get('token') as string
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (password !== confirm) return { error: 'Passwords do not match.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const userId = await verifyAndConsumeToken(token, TokenType.PASSWORD_RESET)
  if (!userId) return { error: 'This link is invalid or has expired.' }

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  })

  redirect('/login')
}
```

- [ ] **Step 4: Create `app/(auth)/reset-password/reset-password-form.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { resetPasswordAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, isPending] = useActionState(resetPasswordAction, { error: null })

  if (!token) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">This reset link is invalid.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Set new password</CardTitle>
        <CardDescription>Enter and confirm your new password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div className="space-y-1">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" required minLength={8} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" name="confirm" type="password" required minLength={8} />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Saving…' : 'Set new password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5: Create `app/(auth)/reset-password/page.tsx`**

```tsx
import { ResetPasswordForm } from './reset-password-form'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  return <ResetPasswordForm token={token ?? ''} />
}
```

- [ ] **Step 6: Build to verify**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/"(auth)"/forgot-password/ app/"(auth)"/reset-password/
git commit -m "feat: add forgot password and reset password pages"
```

---

## Task 12: Verify Email Page + Role Dashboard Layouts

**Files:**
- Create: `app/(auth)/verify-email/page.tsx`
- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/dashboard/page.tsx`
- Create: `app/(teacher)/layout.tsx`
- Create: `app/(teacher)/dashboard/page.tsx`
- Create: `app/(student)/layout.tsx`
- Create: `app/(student)/dashboard/page.tsx`

- [ ] **Step 1: Create `app/(auth)/verify-email/page.tsx`**

```tsx
import Link from 'next/link'
import { db } from '@/lib/db'
import { verifyAndConsumeToken } from '@/lib/auth/tokens'
import { TokenType } from '@/app/generated/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Invalid link</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">This verification link is invalid.</p>
        </CardContent>
      </Card>
    )
  }

  const userId = await verifyAndConsumeToken(token, TokenType.EMAIL_VERIFICATION)

  if (!userId) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Link expired</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            This verification link has expired or already been used.
          </p>
          <p className="mt-4 text-sm text-center">
            <Link href="/login" className="underline underline-offset-4">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  await db.user.update({ where: { id: userId }, data: { isActive: true } })

  return (
    <Card className="w-full max-w-sm">
      <CardHeader><CardTitle>Email verified</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Your email has been verified.</p>
        <p className="mt-4 text-sm text-center">
          <Link href="/login" className="underline underline-offset-4">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create `app/(admin)/layout.tsx`**

```tsx
import { getSession } from '@/lib/auth/session'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  return (
    <div data-user-id={session?.userId} data-user-role={session?.role}>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(admin)/dashboard/page.tsx`**

```tsx
import { getSession } from '@/lib/auth/session'

export default async function AdminDashboardPage() {
  const session = await getSession()
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="text-muted-foreground mt-1">Signed in as {session?.role}</p>
    </main>
  )
}
```

- [ ] **Step 4: Create `app/(teacher)/layout.tsx`**

```tsx
import { getSession } from '@/lib/auth/session'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  return (
    <div data-user-id={session?.userId} data-user-role={session?.role}>
      {children}
    </div>
  )
}
```

- [ ] **Step 5: Create `app/(teacher)/dashboard/page.tsx`**

```tsx
import { getSession } from '@/lib/auth/session'

export default async function TeacherDashboardPage() {
  const session = await getSession()
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
      <p className="text-muted-foreground mt-1">Signed in as {session?.role}</p>
    </main>
  )
}
```

- [ ] **Step 6: Create `app/(student)/layout.tsx`**

```tsx
import { getSession } from '@/lib/auth/session'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  return (
    <div data-user-id={session?.userId} data-user-role={session?.role}>
      {children}
    </div>
  )
}
```

- [ ] **Step 7: Create `app/(student)/dashboard/page.tsx`**

```tsx
import { getSession } from '@/lib/auth/session'

export default async function StudentDashboardPage() {
  const session = await getSession()
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Student Dashboard</h1>
      <p className="text-muted-foreground mt-1">Signed in as {session?.role}</p>
    </main>
  )
}
```

- [ ] **Step 8: Run full test suite**

```bash
pnpm test -- --run
```

Expected: All tests pass.

- [ ] **Step 9: Build**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 10: Commit**

```bash
git add app/"(auth)"/verify-email/ app/"(admin)"/ app/"(teacher)"/ app/"(student)"/
git commit -m "feat: add verify email page and role dashboard layouts"
```

---

## Task 13: Smoke Test

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Test login flow**

1. Navigate to `http://localhost:3000/login`
2. Submit the seed admin credentials (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)
3. Verify redirect to `/admin/dashboard`
4. Verify the page shows "Admin Dashboard" and role "SUPER_ADMIN"

- [ ] **Step 3: Test logout**

1. Navigate to `http://localhost:3000/api/auth/logout`
2. Verify redirect to `/login`
3. Verify that navigating to `/admin/dashboard` redirects back to `/login`

- [ ] **Step 4: Test role enforcement**

1. Login as SUPER_ADMIN
2. Manually navigate to `http://localhost:3000/student/dashboard`
3. Verify redirect to `/admin/dashboard` (wrong-role redirect)

- [ ] **Step 5: Test forgot password**

1. Navigate to `/forgot-password`
2. Submit the admin email
3. Verify "Check your email" confirmation message appears (no error, no email enumeration hint)

- [ ] **Step 6: Commit if anything was fixed during smoke test**

```bash
git add -p
git commit -m "fix: smoke test corrections"
```
