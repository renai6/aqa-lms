'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

type ActionState = { error: string | null }

// Deactivating a student revokes access without destroying their enrollments,
// grades, payments or certificates. It is reversible from the same button.
//
// This action only ever touches STUDENT rows. Admins and teachers are handled
// by toggleUserActiveAction in app/(admin)/admin/users/actions.ts, which in turn
// refuses student targets, so neither action reaches the other's population.
export async function toggleStudentActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const userId = formData.get('userId')
  if (typeof userId !== 'string' || !userId) return { error: 'Invalid student ID.' }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { isActive: true, role: true },
  })
  if (!target) return { error: 'Student not found.' }

  // No self-deactivation guard is needed: an admin is never a STUDENT, so this
  // check already makes self-targeting impossible.
  if (target.role !== 'STUDENT') return { error: 'Forbidden.' }

  try {
    await db.user.update({
      where: { id: userId },
      data: { isActive: !target.isActive },
    })
  } catch (err) {
    console.error('[toggleStudentActive]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/students')
  revalidatePath('/admin/students/' + userId)
  return { error: null }
}
