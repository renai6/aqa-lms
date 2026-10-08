import { z } from 'zod'
import { db } from '@/lib/db'

// A kid profile is a STUDENT user with no email or password, managed by the
// parent account in guardianId. The parent's /student/kids page and the admin
// student page both go through these functions, so both enforce one set of rules.

export type KidActionState = { error: string | null; success?: boolean }

// One kid as the parent's kids page and the admin student page list it.
export type KidListItem = {
  id: string
  firstName: string
  lastName: string
  gender: 'MALE' | 'FEMALE' | null
  isActive: boolean
  // False once the kid has purchases, enrollments or their own login.
  removable: boolean
}

const dependentSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(100, 'First name is too long.'),
  lastName: z.string().trim().min(1, 'Last name is required.').max(100, 'Last name is too long.'),
  // Required, as at registration: a gender-restricted subject is hidden from a
  // student with no gender, so an optional field would hide part of a course.
  gender: z.enum(['MALE', 'FEMALE'], { error: 'Gender is required.' }),
})

export type DependentInput = z.infer<typeof dependentSchema>
export type DependentResult = { ok: true; id: string } | { ok: false; error: string }

export function parseDependentForm(
  formData: FormData,
): { ok: true; data: DependentInput } | { ok: false; error: string } {
  const result = dependentSchema.safeParse({
    firstName: formData.get('firstName') ?? '',
    lastName: formData.get('lastName') ?? '',
    gender: formData.get('gender') ?? undefined,
  })
  if (!result.success) return { ok: false, error: result.error.issues[0]?.message ?? 'Invalid details.' }
  return { ok: true, data: result.data }
}

export async function createDependent(guardianId: string, input: DependentInput): Promise<DependentResult> {
  const guardian = await db.user.findUnique({
    where: { id: guardianId },
    select: { role: true, isActive: true, guardianId: true },
  })
  // One level only: a kid cannot have kids, and staff accounts are not parents.
  if (!guardian || guardian.role !== 'STUDENT' || guardian.guardianId) {
    return { ok: false, error: 'This account cannot add kids.' }
  }
  if (!guardian.isActive) return { ok: false, error: 'This account is inactive.' }

  try {
    const kid = await db.user.create({
      data: { ...input, role: 'STUDENT', guardianId, studentType: 'NEW' },
      select: { id: true },
    })
    return { ok: true, id: kid.id }
  } catch (err) {
    console.error('[createDependent]', err)
    return { ok: false, error: 'A database error occurred. Please try again.' }
  }
}

export async function updateDependent(
  guardianId: string,
  kidId: string,
  input: DependentInput,
): Promise<DependentResult> {
  try {
    // Scoped by guardianId, so a parent can only ever edit their own kids.
    const { count } = await db.user.updateMany({ where: { id: kidId, guardianId }, data: input })
    if (count === 0) return { ok: false, error: 'Kid not found.' }
    return { ok: true, id: kidId }
  } catch (err) {
    console.error('[updateDependent]', err)
    return { ok: false, error: 'A database error occurred. Please try again.' }
  }
}

// Only a kid with no purchases, enrollments or own login can be removed. After
// that the profile carries payment and grade history that must stay auditable,
// and a kid with an email is a real login account.
export async function removeDependent(guardianId: string, kidId: string): Promise<DependentResult> {
  const kid = await db.user.findFirst({
    where: { id: kidId, guardianId },
    select: { email: true, _count: { select: { purchases: true, enrollments: true } } },
  })
  if (!kid) return { ok: false, error: 'Kid not found.' }
  if (kid.email) return { ok: false, error: 'This kid has their own login, so the profile cannot be removed.' }
  if (kid._count.purchases > 0 || kid._count.enrollments > 0) {
    return { ok: false, error: 'This kid already has enrollments or purchases, so the profile cannot be removed.' }
  }

  try {
    await db.user.delete({ where: { id: kidId } })
    return { ok: true, id: kidId }
  } catch (err) {
    // A purchase created between the check and the delete trips the foreign key.
    console.error('[removeDependent]', err)
    return { ok: false, error: 'This profile could not be removed. Please refresh and try again.' }
  }
}

// An admin turns an existing student account into a kid of another account.
// The student keeps their own email and password; only guardianId is set.
export async function linkDependent(kidId: string, guardianEmail: string): Promise<DependentResult> {
  const alreadyLinked = 'This student is already linked to a parent.'
  try {
    const guardian = await db.user.findUnique({
      where: { email: guardianEmail.trim().toLowerCase() },
      select: { id: true, role: true, isActive: true, guardianId: true },
    })
    if (!guardian || guardian.role !== 'STUDENT' || guardian.guardianId) {
      return { ok: false, error: 'No eligible parent account has that email.' }
    }
    if (!guardian.isActive) return { ok: false, error: 'That parent account is inactive.' }
    if (guardian.id === kidId) return { ok: false, error: 'A student cannot be linked to their own account.' }

    const kid = await db.user.findUnique({
      where: { id: kidId },
      select: { role: true, guardianId: true, _count: { select: { dependents: true } } },
    })
    if (!kid || kid.role !== 'STUDENT') return { ok: false, error: 'Student not found.' }
    if (kid.guardianId) return { ok: false, error: alreadyLinked }
    if (kid._count.dependents > 0) {
      return { ok: false, error: 'This student has kids of their own, so they cannot be linked to a parent.' }
    }

    // The filters make a concurrent link, or a kid added meanwhile, lose cleanly.
    const { count } = await db.user.updateMany({
      where: { id: kidId, guardianId: null, dependents: { none: {} } },
      data: { guardianId: guardian.id },
    })
    if (count === 0) return { ok: false, error: alreadyLinked }
    return { ok: true, id: kidId }
  } catch (err) {
    console.error('[linkDependent]', err)
    return { ok: false, error: 'A database error occurred. Please try again.' }
  }
}
