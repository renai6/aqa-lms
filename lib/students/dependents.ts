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
  // Has purchases or enrollments, so it can no longer be removed.
  hasHistory: boolean
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

// Only a kid with no purchases or enrollments can be removed. After that the
// profile carries payment and grade history that must stay auditable.
export async function removeDependent(guardianId: string, kidId: string): Promise<DependentResult> {
  const kid = await db.user.findFirst({
    where: { id: kidId, guardianId },
    select: { _count: { select: { purchases: true, enrollments: true } } },
  })
  if (!kid) return { ok: false, error: 'Kid not found.' }
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
