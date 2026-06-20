'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { hashPassword } from '@/lib/auth/password'
import { generateTempPassword } from '@/lib/enrollments/password'
import { sendEnrollmentApprovalEmail, sendEnrollmentRejectionEmail } from '@/lib/enrollments/email'

type ActionState = { error: string | null; success?: boolean }

export async function approveEnrollmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // 1. Read and validate id
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) {
    return { error: 'Invalid enrollment request ID.' }
  }

  // 2. Auth check
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  // 3. Fetch the enrollment request (to get email, names, courseId etc.)
  const request = await db.enrollmentRequest.findUnique({
    where: { id },
    include: { course: { select: { title: true } } },
  })
  if (!request) return { error: 'Enrollment request not found.' }

  // 4. Generate and hash temp password
  const tempPassword = generateTempPassword()
  const hashedPassword = await hashPassword(tempPassword)

  // 5. Atomically check PENDING status, create user, enrollment, and update request
  let newUser: { id: string }
  try {
    newUser = await db.$transaction(async (tx) => {
      // Atomic PENDING check — updateMany returns count; if 0, someone beat us to it
      const updated = await tx.enrollmentRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVED' },
      })
      if (updated.count === 0) {
        throw new Error('ALREADY_PROCESSED')
      }

      const user = await tx.user.create({
        data: {
          email: request.email,
          firstName: request.firstName,
          lastName: request.lastName,
          passwordHash: hashedPassword,
          role: 'STUDENT',
          isActive: true,
          mustChangePassword: true,
        },
      })

      await tx.enrollment.create({
        data: { userId: user.id, courseId: request.courseId },
      })

      // Link the new user to the enrollment request
      await tx.enrollmentRequest.update({
        where: { id },
        data: { userId: user.id },
      })

      return user
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'ALREADY_PROCESSED') {
      return { error: 'This request has already been processed.' }
    }
    // Prisma unique constraint on User.email
    if (msg.includes('P2002') || msg.includes('Unique constraint')) {
      return { error: 'A user with this email already exists.' }
    }
    console.error('[approveEnrollment] Transaction error:', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  // 6. Revalidate enrollments list — DB is committed, cache must be updated regardless of email
  revalidatePath('/admin/enrollments')

  // 7. Send approval email — do NOT rollback if this fails, account already exists
  try {
    await sendEnrollmentApprovalEmail({
      to: request.email,
      firstName: request.firstName,
      courseName: request.course.title,
      tempPassword,
    })
  } catch (err) {
    console.error('Failed to send enrollment approval email:', err)
    return {
      error: 'Account created but email delivery failed. Contact the student directly.',
      success: true,
    }
  }

  // 8. Return success
  return { error: null, success: true }
}

export async function rejectEnrollmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // 1. Read and validate id — first check before any other validation
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) {
    return { error: 'Invalid enrollment request ID.' }
  }

  // 2. Validate reason with Zod
  const reasonRaw = formData.get('reason')
  const reasonResult = z.string().min(1, 'A reason is required.').safeParse(reasonRaw)
  if (!reasonResult.success) {
    return { error: reasonResult.error.issues[0]?.message ?? 'A reason is required.' }
  }
  const reason = reasonResult.data

  // 3. Auth check
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  // 4. Fetch the enrollment request
  const request = await db.enrollmentRequest.findUnique({
    where: { id },
    include: { course: { select: { title: true } } },
  })
  if (!request) return { error: 'Enrollment request not found.' }
  if (request.status !== 'PENDING') return { error: 'This request has already been processed.' }

  // 5. Update status to REJECTED with admin remarks
  try {
    await db.enrollmentRequest.update({
      where: { id },
      data: { status: 'REJECTED', adminRemarks: reason },
    })
  } catch (err) {
    console.error('[rejectEnrollment] DB error:', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  // 6. Revalidate enrollments list — DB is committed, cache must be updated regardless of email
  revalidatePath('/admin/enrollments')

  // 7. Send rejection email — do NOT rollback if this fails, rejection is already recorded
  try {
    await sendEnrollmentRejectionEmail({
      to: request.email,
      firstName: request.firstName,
      courseName: request.course.title,
      reason,
    })
  } catch (err) {
    console.error('Failed to send enrollment rejection email:', err)
    return {
      error: 'Request rejected but notification email failed. Student was not notified.',
      success: true,
    }
  }

  // 8. Return success
  return { error: null, success: true }
}
