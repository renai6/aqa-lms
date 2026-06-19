# Authentication & Roles — Design Spec

**Date:** 2026-06-19  
**Status:** Approved  
**Scope:** Custom JWT auth, role-based routing, email verification, password reset, seed script

---

## Overview

Custom authentication for the AQA LMS using signed JWTs stored in HTTP-only cookies. No third-party auth provider. Four roles: `SUPER_ADMIN`, `ADMIN`, `TEACHER`, `STUDENT`. Route protection is enforced centrally in `middleware.ts`. Server components access the current user via request headers forwarded by middleware.

---

## 1. File Structure

```
app/
  (auth)/
    login/page.tsx
    forgot-password/page.tsx
    reset-password/page.tsx
    verify-email/page.tsx
  (admin)/
    layout.tsx          ← reads session headers, provides user to children (no redirect — middleware handles that)
    dashboard/page.tsx
  (student)/
    layout.tsx          ← reads session headers, provides user to children
    dashboard/page.tsx
  (teacher)/
    layout.tsx          ← reads session headers, provides user to children
    dashboard/page.tsx

middleware.ts
lib/
  auth/
    session.ts          ← sign/verify JWT, set/clear cookie
    password.ts         ← bcryptjs hash/compare
    email.ts            ← Resend: send verification + reset emails
    tokens.ts           ← generate/verify VerificationToken records

prisma/seed.ts
```

---

## 2. Schema Additions

Add to `prisma/schema.prisma`:

```prisma
enum TokenType {
  EMAIL_VERIFICATION
  PASSWORD_RESET
}

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

Add `verificationTokens VerificationToken[]` relation to `User`.

---

## 3. Session & JWT

- Library: `jose` (Edge-compatible, required by Next.js middleware)
- Secret: `JWT_SECRET` env var
- Payload: `{ sub: userId, role: UserRole, email: string }`
- Cookie: `session`, `HttpOnly`, `Secure` (prod), `SameSite=Lax`, 7-day expiry

**`lib/auth/session.ts` exports:**
- `createSession(user)` — signs JWT, sets cookie
- `getSession()` — reads `x-user-id` / `x-user-role` headers (server components only)
- `clearSession()` — clears the cookie

---

## 4. Middleware

**File:** `middleware.ts`

**Public paths** (no auth required):
- `/login`, `/forgot-password`, `/reset-password`, `/verify-email`
- `/api/auth/*`
- All other non-dashboard paths (public website)

**Authenticated users hitting `/login`:** redirect to their role dashboard.

**Protected path rules:**

| Path prefix | Allowed roles | On failure |
|---|---|---|
| `/admin/*` | `SUPER_ADMIN`, `ADMIN` | redirect `/login` |
| `/teacher/*` | `TEACHER` | redirect `/login` |
| `/student/*` | `STUDENT` | redirect `/login` |

**On valid JWT:** forward `x-user-id` and `x-user-role` headers to the route.  
**On invalid/expired JWT:** clear cookie, redirect to `/login`.  
**Wrong role:** redirect to the user's correct dashboard (not `/login`).

---

## 5. Login Flow

**Page:** `/login`

1. User submits email + password via server action
2. Look up user by email; check `isActive === true`
3. Compare password with `bcryptjs`
4. Success → `createSession(user)` → redirect to role dashboard
5. Failure → generic error: "Invalid email or password" (no field-level hint)
6. Unverified account (`isActive === false`) → specific error with "Resend verification email" link

**Logout:** `GET /api/auth/logout` — clears cookie, redirects to `/login`.

---

## 6. Email Verification

Triggered whenever a new user account is created (by admin or on enrollment approval).

1. Generate a random token, store in `VerificationToken` (type: `EMAIL_VERIFICATION`, expires: 24h)
2. Resend sends link: `/verify-email?token=...`
3. `/verify-email` page: verify token, set `User.isActive = true`, delete token, redirect to `/login`
4. Expired/invalid token → show error with "Resend verification email" option

---

## 7. Password Reset

1. `/forgot-password`: user submits email → generate token in `VerificationToken` (type: `PASSWORD_RESET`, expires: 1h) → Resend sends `/reset-password?token=...`
2. `/reset-password`: user submits new password → verify token not expired → hash + update password → delete token → redirect to `/login`
3. Expired/used token → clear error message

Email is always sent even if address not found (prevents email enumeration).

---

## 8. Seed Script

**File:** `prisma/seed.ts`

- Idempotent: skips if any `SUPER_ADMIN` already exists
- Reads credentials from env: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`
- Sets `isActive = true` (skips email verification)
- Run with: `pnpm prisma db seed`

---

## 9. Environment Variables

```
JWT_SECRET=
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
NEXT_PUBLIC_APP_URL=      # used for email links
```

---

## 10. Out of Scope (for this module)

- OAuth / social login
- Multi-factor authentication
- Session revocation (JWT is stateless; logout is client-side cookie clear only)
- Remember me / extended sessions
- Account lockout after failed attempts
