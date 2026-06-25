'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { registerSchema } from '@/lib/purchases/schema'

type RegisterValues = Record<
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'gender'
  | 'address'
  | 'contactNumber'
  | 'facebookName'
  | 'facebookLink'
  | 'studentType',
  string
>

// Echoed back on error so the form keeps the user's input instead of resetting.
type ActionState = { error: string | null; values?: RegisterValues }

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    gender: formData.get('gender'),
    address: formData.get('address'),
    contactNumber: formData.get('contactNumber'),
    facebookName: formData.get('facebookName'),
    facebookLink: formData.get('facebookLink'),
    studentType: formData.get('studentType'),
  }

  const values: RegisterValues = {
    firstName: String(raw.firstName ?? ''),
    lastName: String(raw.lastName ?? ''),
    email: String(raw.email ?? ''),
    password: String(raw.password ?? ''),
    confirmPassword: String(raw.confirmPassword ?? ''),
    gender: String(raw.gender ?? ''),
    address: String(raw.address ?? ''),
    contactNumber: String(raw.contactNumber ?? ''),
    facebookName: String(raw.facebookName ?? ''),
    facebookLink: String(raw.facebookLink ?? ''),
    studentType: String(raw.studentType ?? ''),
  }

  const result = registerSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.', values }
  }
  const d = result.data
  const email = d.email.trim().toLowerCase()

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) return { error: 'An account with this email already exists.', values }

  let user: { id: string; role: 'STUDENT'; email: string }
  try {
    const created = await db.user.create({
      data: {
        email,
        passwordHash: await hashPassword(d.password),
        firstName: d.firstName,
        lastName: d.lastName,
        role: 'STUDENT',
        isActive: true,
        mustChangePassword: false,
        gender: d.gender,
        address: d.address,
        contactNumber: d.contactNumber,
        facebookName: d.facebookName,
        facebookLink: d.facebookLink,
        studentType: d.studentType,
      },
      select: { id: true, role: true, email: true },
    })
    user = created as typeof user
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('P2002') || msg.includes('Unique constraint')) {
      return { error: 'An account with this email already exists.', values }
    }
    console.error('[register] DB error:', err)
    return { error: 'A database error occurred. Please try again.', values }
  }

  await createSession({ id: user.id, role: user.role, email: user.email, mustChangePassword: false })
  redirect('/student/courses')
}
