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
  } catch (err) {
    console.error('[createUser]', err)
    return { error: 'Failed to create user. Please try again.' }
  }

  try {
    await sendCredentialsEmail(email, firstName, tempPassword)
  } catch (err) {
    console.error('[createUser:email]', err)
    // User created successfully; email failure is non-fatal
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
