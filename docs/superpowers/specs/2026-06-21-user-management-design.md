# User Management Design

**Date:** 2026-06-21
**Status:** Approved
**Scope:** Admin UI to list, create, and deactivate/reactivate Admin and Teacher accounts

---

## Overview

A new `/admin/users` page with URL-based tabs — one for Admins, one for Teachers. Admins can list existing users of each role, create new accounts (auto-generated temp password emailed to the new user), and toggle a user's active status. No edit functionality in this scope (YAGNI).

---

## 1. Routing & Page Structure

**Route:** `app/(admin)/admin/users/page.tsx`

- Server component reads `searchParams.tab` (`"admins"` | `"teachers"`, defaults to `"admins"`)
- Fetches users of the active role only (one query per load)
- Renders: `TabSwitcher` → `UserTable` → `CreateUserForm`, stacked vertically
- Nav link "Users" added to the admin navigation alongside Courses and Enrollments

**URL shape:**
- `/admin/users` → defaults to Admins tab
- `/admin/users?tab=admins` → Admins tab
- `/admin/users?tab=teachers` → Teachers tab

Tab state is in the URL — survives refresh and is shareable.

---

## 2. Data Layer

### `lib/users/queries.ts`

```ts
export type UserRow = {
  id: string
  firstName: string
  lastName: string
  email: string
  isActive: boolean
  createdAt: Date
}

export async function getUsersByRole(role: 'ADMIN' | 'TEACHER'): Promise<UserRow[]>
// Orders by lastName asc
```

### `app/(admin)/admin/users/actions.ts`

**`createUserAction(formData)`**
- Input: `firstName`, `lastName`, `email`, `role` (hidden — `"ADMIN"` or `"TEACHER"`)
- Zod 4 validation: all fields required, email must be valid format
- Checks email is not already in use
- Auto-generates a 10-char alphanumeric temp password using `crypto.getRandomValues`
- Creates `User` with `isActive: true`, `mustChangePassword: true`
- Sends credentials email via existing `lib/auth/email.ts` (Resend)
- Revalidates `/admin/users`
- Returns `{ error: null, success: true }` or `{ error: string }`

**`toggleUserActiveAction(formData)`**
- Input: `userId`, `currentIsActive` (boolean as string `"true"` / `"false"`)
- Flips `isActive` on the user (deactivate if active, reactivate if inactive)
- Revalidates `/admin/users`
- Returns `{ error: null }` or `{ error: string }`

---

## 3. UI Components

All files in `app/(admin)/admin/users/`:

### `tab-switcher.tsx` — `'use client'`
Two buttons ("Admins" / "Teachers"). Uses `useRouter` + `useSearchParams` to push `?tab=admins` or `?tab=teachers`. Active tab is visually highlighted (underline or pill style matching existing admin UI).

### `user-table.tsx` — server component
Table columns: **Name**, **Email**, **Status** (Active / Inactive badge), **Created**, **Actions**.

Each row has a form with `toggleUserActiveAction`:
- Button label: "Deactivate" when `isActive = true`, "Reactivate" when `isActive = false`
- Destructive style for Deactivate, neutral for Reactivate

Empty state: "No admins yet." / "No teachers yet."

### `create-user-form.tsx` — `'use client'`
Card with fields: First Name, Last Name, Email. Role passed as hidden input (set by page based on active tab). Uses `useActionState`. On success: shows "Account created and credentials emailed." and resets the form via `useRef` + `useEffect`.

### `page.tsx` — server component
Reads `searchParams.tab`, calls `getUsersByRole`, renders `TabSwitcher` + `UserTable` + `CreateUserForm`.

---

## 4. Email

Reuses `lib/auth/email.ts` (existing Resend setup). A new `sendCredentialsEmail(to: string, firstName: string, tempPassword: string)` function sends the new user their login credentials and a note that they must change their password on first login.

---

## 5. Files Changed / Created

| File | Action |
|------|--------|
| `lib/users/queries.ts` | Create — `getUsersByRole` query |
| `app/(admin)/admin/users/actions.ts` | Create — `createUserAction`, `toggleUserActiveAction` |
| `app/(admin)/admin/users/page.tsx` | Create — server component page |
| `app/(admin)/admin/users/tab-switcher.tsx` | Create — client tab navigation |
| `app/(admin)/admin/users/user-table.tsx` | Create — user list with toggle |
| `app/(admin)/admin/users/create-user-form.tsx` | Create — create user form |
| `lib/auth/email.ts` | Modify — add `sendCredentialsEmail` |
| `app/(admin)/layout.tsx` | Modify — add `NavLink` for `/admin/users` with `UserCog` icon (lucide-react), after Enrollments |

---

## 6. Out of Scope

- Editing user details (name, email)
- Deleting users permanently
- Password reset initiated by admin
- Role changes after creation
- Pagination (implement when user count warrants it)
