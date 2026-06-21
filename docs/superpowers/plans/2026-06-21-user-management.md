# User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `/admin/users` page with Admins and Teachers tabs — list, create (auto-generated password emailed), and deactivate/reactivate users.

**Architecture:** URL-based tabs (`?tab=admins` / `?tab=teachers`). Server component page fetches one role per load and composes a client `TabSwitcher`, server `UserTable`, and client `CreateUserForm`. Two server actions (`createUserAction`, `toggleUserActiveAction`) live in the page's `actions.ts`. A new `sendCredentialsEmail` function is added to the existing `lib/auth/email.ts`.

**Tech Stack:** Next.js 16 App Router, React 19 `useActionState`, Prisma 7, Zod 4, Resend, bcryptjs, shadcn/ui, Tailwind CSS 4.

---

## File Map

| File | Action |
|------|--------|
| `lib/auth/email.ts` | Modify — add `sendCredentialsEmail` |
| `lib/users/queries.ts` | Create — `getUsersByRole` query + `UserRow` type |
| `app/(admin)/admin/users/actions.ts` | Create — `createUserAction`, `toggleUserActiveAction` |
| `app/(admin)/admin/users/tab-switcher.tsx` | Create — client tab navigation |
| `app/(admin)/admin/users/toggle-active-button.tsx` | Create — client deactivate/reactivate button |
| `app/(admin)/admin/users/user-table.tsx` | Create — server component user list |
| `app/(admin)/admin/users/create-user-form.tsx` | Create — client create form |
| `app/(admin)/admin/users/page.tsx` | Create — server component page |
| `app/(admin)/layout.tsx` | Modify — add Users nav link |

---

### Task 1: Email — sendCredentialsEmail

**Files:**
- Modify: `lib/auth/email.ts`

- [ ] **Step 1: Add sendCredentialsEmail to lib/auth/email.ts**

The file currently exports `sendVerificationEmail` and `sendPasswordResetEmail`. Add after them:

```ts
export async function sendCredentialsEmail(
  to: string,
  firstName: string,
  tempPassword: string,
) {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: 'Your AQA LMS account credentials',
    html: `
      <p>Hi ${firstName},</p>
      <p>Your account has been created on the AQA Learning Management System.</p>
      <p><strong>Email:</strong> ${to}<br/>
      <strong>Temporary Password:</strong> ${tempPassword}</p>
      <p>Please <a href="${loginUrl}">log in</a> and change your password on first login.</p>
    `,
  })
  if (error) throw new Error(`Failed to send credentials email: ${error.message}`)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | grep -E "error TS" | head -10
```

Expected: no output (no TS errors).

- [ ] **Step 3: Commit**

```bash
git add lib/auth/email.ts
git commit -m "feat: add sendCredentialsEmail to lib/auth/email"
```

---

### Task 2: Query — getUsersByRole

**Files:**
- Create: `lib/users/queries.ts`

- [ ] **Step 1: Create lib/users/queries.ts**

```ts
import { db } from '@/lib/db'

export type UserRow = {
  id: string
  firstName: string
  lastName: string
  email: string
  isActive: boolean
  createdAt: Date
}

export async function getUsersByRole(role: 'ADMIN' | 'TEACHER'): Promise<UserRow[]> {
  return db.user.findMany({
    where: { role },
    orderBy: { lastName: 'asc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | grep -E "error TS" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/users/queries.ts
git commit -m "feat: add getUsersByRole query"
```

---

### Task 3: Server actions — createUserAction and toggleUserActiveAction

**Files:**
- Create: `app/(admin)/admin/users/actions.ts`

- [ ] **Step 1: Create app/(admin)/admin/users/actions.ts**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { hashPassword } from '@/lib/auth/password'
import { sendCredentialsEmail } from '@/lib/auth/email'

type ActionState = { error: string | null; success?: boolean }

const createUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  email: z.string().email('Invalid email address.'),
  role: z.enum(['ADMIN', 'TEACHER']),
})

function generateTempPassword(): string {
  // Excludes visually ambiguous characters: O, 0, I, l, 1
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const raw = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    role: formData.get('role'),
  }

  const result = createUserSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  const { firstName, lastName, email, role } = result.data

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) return { error: 'A user with this email already exists.' }

  const tempPassword = generateTempPassword()
  const passwordHash = await hashPassword(tempPassword)

  try {
    await db.user.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash,
        role,
        isActive: true,
        mustChangePassword: true,
      },
    })
    await sendCredentialsEmail(email, firstName, tempPassword)
  } catch (err) {
    console.error('[createUser]', err)
    return { error: 'Failed to create user. Please try again.' }
  }

  revalidatePath('/admin/users')
  return { error: null, success: true }
}

export async function toggleUserActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const userId = formData.get('userId')
  if (typeof userId !== 'string' || !userId) return { error: 'Invalid user ID.' }

  const currentIsActive = formData.get('currentIsActive') === 'true'

  try {
    await db.user.update({
      where: { id: userId },
      data: { isActive: !currentIsActive },
    })
  } catch (err) {
    console.error('[toggleUserActive]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/users')
  return { error: null }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | grep -E "error TS" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/users/actions.ts"
git commit -m "feat: add createUserAction and toggleUserActiveAction"
```

---

### Task 4: TabSwitcher component

**Files:**
- Create: `app/(admin)/admin/users/tab-switcher.tsx`

- [ ] **Step 1: Create tab-switcher.tsx**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

type Tab = 'admins' | 'teachers'
type Props = { activeTab: Tab }

export function TabSwitcher({ activeTab }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function switchTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push('?' + params.toString())
  }

  return (
    <div className="flex gap-1 border-b border-border mb-6">
      {(['admins', 'teachers'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => switchTab(tab)}
          className={cn(
            'px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
            activeTab === tab
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tab === 'admins' ? 'Admins' : 'Teachers'}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | grep -E "error TS" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/users/tab-switcher.tsx"
git commit -m "feat: add TabSwitcher component for user management"
```

---

### Task 5: ToggleActiveButton component

**Files:**
- Create: `app/(admin)/admin/users/toggle-active-button.tsx`

- [ ] **Step 1: Create toggle-active-button.tsx**

```tsx
'use client'

import { useActionState } from 'react'
import { toggleUserActiveAction } from './actions'
import { Button } from '@/components/ui/button'

type Props = {
  userId: string
  isActive: boolean
}

export function ToggleActiveButton({ userId, isActive }: Props) {
  const [state, formAction, isPending] = useActionState(toggleUserActiveAction, { error: null })

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="currentIsActive" value={String(isActive)} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={isPending}
        className={
          isActive
            ? 'text-destructive hover:text-destructive h-7 px-2'
            : 'text-muted-foreground hover:text-foreground h-7 px-2'
        }
      >
        {isPending ? '...' : isActive ? 'Deactivate' : 'Reactivate'}
      </Button>
      {state.error && <p className="text-xs text-destructive mt-1">{state.error}</p>}
    </form>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | grep -E "error TS" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/users/toggle-active-button.tsx"
git commit -m "feat: add ToggleActiveButton component"
```

---

### Task 6: UserTable component

**Files:**
- Create: `app/(admin)/admin/users/user-table.tsx`

- [ ] **Step 1: Create user-table.tsx**

```tsx
import { cn } from '@/lib/utils'
import { ToggleActiveButton } from './toggle-active-button'
import type { UserRow } from '@/lib/users/queries'

type Props = {
  users: UserRow[]
  role: 'admins' | 'teachers'
}

export function UserTable({ users, role }: Props) {
  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">No {role} yet.</p>
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Email</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Created</th>
            <th scope="col" aria-label="Actions" className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-muted/50 transition-colors">
              <td className="px-4 py-3 font-medium">{u.firstName} {u.lastName}</td>
              <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                    u.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-zinc-100 text-zinc-600',
                  )}
                >
                  {u.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs">
                {u.createdAt.toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <ToggleActiveButton userId={u.id} isActive={u.isActive} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | grep -E "error TS" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/users/user-table.tsx"
git commit -m "feat: add UserTable component"
```

---

### Task 7: CreateUserForm component

**Files:**
- Create: `app/(admin)/admin/users/create-user-form.tsx`

- [ ] **Step 1: Create create-user-form.tsx**

```tsx
'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createUserAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {
  role: 'ADMIN' | 'TEACHER'
  roleLabel: string
}

export function CreateUserForm({ role, roleLabel }: Props) {
  const [state, formAction, isPending] = useActionState(createUserAction, { error: null })
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state.success])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add {roleLabel}</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="role" value={role} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" name="firstName" required placeholder="Juan" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" name="lastName" required placeholder="dela Cruz" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="juan@example.com"
            />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && !state.error && (
            <p className="text-sm text-green-600">Account created and credentials emailed.</p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating...' : `Add ${roleLabel}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | grep -E "error TS" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/users/create-user-form.tsx"
git commit -m "feat: add CreateUserForm component"
```

---

### Task 8: Page composition + nav link

**Files:**
- Create: `app/(admin)/admin/users/page.tsx`
- Modify: `app/(admin)/layout.tsx`

- [ ] **Step 1: Create app/(admin)/admin/users/page.tsx**

```tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getUsersByRole } from '@/lib/users/queries'
import { TabSwitcher } from './tab-switcher'
import { UserTable } from './user-table'
import { CreateUserForm } from './create-user-form'

type Props = { searchParams: Promise<{ tab?: string }> }

export const metadata = { title: 'Users — AQA Admin' }

export default async function UsersPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { tab } = await searchParams
  const activeTab = tab === 'teachers' ? 'teachers' : 'admins'

  const role = activeTab === 'admins' ? 'ADMIN' : 'TEACHER'
  const roleLabel = activeTab === 'admins' ? 'Admin' : 'Teacher'

  const users = await getUsersByRole(role)

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      <TabSwitcher activeTab={activeTab} />
      <UserTable users={users} role={activeTab} />
      <CreateUserForm role={role} roleLabel={roleLabel} />
    </div>
  )
}
```

- [ ] **Step 2: Add Users nav link to app/(admin)/layout.tsx**

At the top of the file, add `UserCog` to the lucide-react import:

```ts
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart2,
  LogOut,
  UserCog,
} from 'lucide-react'
```

Then add a `NavLink` after the Enrollments link and before the Courses link:

```tsx
          <NavLink
            href="/admin/users"
            icon={<UserCog className="w-5 h-5" aria-hidden="true" />}
            label="Users"
          />
```

- [ ] **Step 3: Verify full build passes**

```bash
pnpm build 2>&1 | tail -20
```

Expected: all pages listed, no errors. Look for `/admin/users` in the output.

- [ ] **Step 4: Manual verification**

Start dev server:
```bash
pnpm dev
```

1. Navigate to `/admin/users` — confirm "Users" page loads with Admins tab active
2. Click "Teachers" tab — URL becomes `?tab=teachers`, list changes
3. Refresh on Teachers tab — tab stays on Teachers (URL preserved)
4. Create a teacher: fill in form, submit — confirm success message appears and form resets
5. Confirm created teacher appears in the list
6. Click "Deactivate" on a user — status badge changes to "Inactive", button changes to "Reactivate"
7. Click "Reactivate" — status changes back to "Active"
8. Try creating with a duplicate email — confirm "A user with this email already exists." error
9. Confirm "Users" nav link is highlighted when on `/admin/users`

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/users/page.tsx" "app/(admin)/layout.tsx"
git commit -m "feat: add user management page with Admins/Teachers tabs"
```
