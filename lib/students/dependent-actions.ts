'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getAccountSession } from '@/lib/auth/session'
import { setActiveProfile } from '@/lib/auth/profile'
import {
  createDependent,
  parseDependentForm,
  removeDependent,
  updateDependent,
  type KidActionState,
} from '@/lib/students/dependents'

// Kids belong to the logged-in account, never to whichever profile is selected,
// so every action here reads getAccountSession rather than getSession.
async function studentAccount() {
  const account = await getAccountSession()
  return account?.role === 'STUDENT' ? account : null
}

function kidIdFrom(formData: FormData): string {
  return String(formData.get('kidId') ?? '')
}

export async function switchProfileAction(formData: FormData): Promise<void> {
  const account = await studentAccount()
  if (!account) redirect('/login')

  const kidId = kidIdFrom(formData)
  if (!kidId) {
    await setActiveProfile(null)
  } else {
    // Same check getSession makes, so the cookie never names someone else's kid.
    const kid = await db.user.findFirst({
      where: { id: kidId, guardianId: account.userId, isActive: true, role: 'STUDENT', guardian: { isActive: true } },
      select: { id: true },
    })
    await setActiveProfile(kid?.id ?? null)
  }
  // The dashboard, not the current page: the current page may be an
  // enrollment or attempt that belongs only to the previous profile.
  redirect('/student/dashboard')
}

export async function addKidAction(_prev: KidActionState, formData: FormData): Promise<KidActionState> {
  const account = await studentAccount()
  if (!account) return { error: 'Unauthorized' }

  const parsed = parseDependentForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const result = await createDependent(account.userId, parsed.data)
  if (!result.ok) return { error: result.error }

  // A parent adds a kid to enroll them, so land on the catalog as that kid.
  await setActiveProfile(result.id)
  redirect('/student/courses')
}

export async function updateKidAction(_prev: KidActionState, formData: FormData): Promise<KidActionState> {
  const account = await studentAccount()
  if (!account) return { error: 'Unauthorized' }

  const parsed = parseDependentForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const result = await updateDependent(account.userId, kidIdFrom(formData), parsed.data)
  if (!result.ok) return { error: result.error }

  // The layout shows kids' names in the profile menu.
  revalidatePath('/student', 'layout')
  return { error: null, success: true }
}

export async function removeKidAction(_prev: KidActionState, formData: FormData): Promise<KidActionState> {
  const account = await studentAccount()
  if (!account) return { error: 'Unauthorized' }

  const result = await removeDependent(account.userId, kidIdFrom(formData))
  if (!result.ok) return { error: result.error }

  revalidatePath('/student', 'layout')
  return { error: null, success: true }
}
