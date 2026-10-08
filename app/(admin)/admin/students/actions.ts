'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import {
  createDependent,
  parseDependentForm,
  removeDependent,
  updateDependent,
  type KidActionState,
} from '@/lib/students/dependents'

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

async function isAdmin(): Promise<boolean> {
  const session = await getSession()
  return session?.role === 'ADMIN' || session?.role === 'SUPER_ADMIN'
}

// For walk-ins: an admin adds a kid to a parent's account from the parent's
// student page. The same rules as the parent's own form apply.
function revalidateFamily(guardianId: string, kidId?: string) {
  revalidatePath('/admin/students')
  revalidatePath('/admin/students/' + guardianId)
  if (kidId) revalidatePath('/admin/students/' + kidId)
}

export async function addKidAdminAction(_prev: KidActionState, formData: FormData): Promise<KidActionState> {
  if (!(await isAdmin())) return { error: 'Forbidden' }
  const guardianId = String(formData.get('guardianId') ?? '')
  const parsed = parseDependentForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const result = await createDependent(guardianId, parsed.data)
  if (!result.ok) return { error: result.error }
  revalidateFamily(guardianId)
  return { error: null, success: true }
}

export async function updateKidAdminAction(_prev: KidActionState, formData: FormData): Promise<KidActionState> {
  if (!(await isAdmin())) return { error: 'Forbidden' }
  const guardianId = String(formData.get('guardianId') ?? '')
  const kidId = String(formData.get('kidId') ?? '')
  const parsed = parseDependentForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const result = await updateDependent(guardianId, kidId, parsed.data)
  if (!result.ok) return { error: result.error }
  revalidateFamily(guardianId, kidId)
  return { error: null, success: true }
}

export async function removeKidAdminAction(_prev: KidActionState, formData: FormData): Promise<KidActionState> {
  if (!(await isAdmin())) return { error: 'Forbidden' }
  const guardianId = String(formData.get('guardianId') ?? '')
  const kidId = String(formData.get('kidId') ?? '')

  const result = await removeDependent(guardianId, kidId)
  if (!result.ok) return { error: result.error }
  revalidateFamily(guardianId, kidId)
  return { error: null, success: true }
}
