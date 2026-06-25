'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { paymentStatusFromType } from '@/lib/purchases/payment'
import { sendPurchaseApprovalEmail, sendPurchaseRejectionEmail } from '@/lib/purchases/email'

type ActionState = { error: string | null; success?: boolean }

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { ok: false as const, error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    return { ok: false as const, error: 'Forbidden' }
  }
  return { ok: true as const, userId: session.userId }
}

export async function approvePurchaseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid purchase ID.' }

  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  const purchase = await db.purchase.findUnique({
    where: { id },
    select: {
      paymentType: true,
      user: { select: { id: true, email: true, firstName: true } },
      items: { select: { courseId: true, course: { select: { title: true } } } },
    },
  })
  if (!purchase) return { error: 'Purchase not found.' }

  const paymentStatus = paymentStatusFromType(purchase.paymentType)

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.purchase.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVED', reviewedById: auth.userId, reviewedAt: new Date() },
      })
      if (updated.count === 0) throw new Error('ALREADY_PROCESSED')

      for (const item of purchase.items) {
        const exists = await tx.enrollment.findUnique({
          where: { userId_courseId: { userId: purchase.user.id, courseId: item.courseId } },
          select: { id: true },
        })
        if (exists) continue
        await tx.enrollment.create({
          data: {
            userId: purchase.user.id,
            courseId: item.courseId,
            paymentStatus,
            purchaseId: id,
          },
        })
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'ALREADY_PROCESSED') return { error: 'This purchase has already been processed.' }
    console.error('[approvePurchase] Transaction error:', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/purchases')

  try {
    await sendPurchaseApprovalEmail({
      to: purchase.user.email,
      firstName: purchase.user.firstName,
      courseNames: purchase.items.map((i) => i.course.title),
    })
  } catch (err) {
    console.error('[approvePurchase] Email error:', err)
    return { error: 'Purchase approved but email delivery failed. Contact the student directly.', success: true }
  }

  redirect('/admin/purchases')
}

export async function rejectPurchaseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid purchase ID.' }

  const reasonResult = z.string().min(1, 'A reason is required.').safeParse(formData.get('reason'))
  if (!reasonResult.success) return { error: reasonResult.error.issues[0]?.message ?? 'A reason is required.' }
  const reason = reasonResult.data

  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  const purchase = await db.purchase.findUnique({
    where: { id },
    select: { user: { select: { email: true, firstName: true } } },
  })
  if (!purchase) return { error: 'Purchase not found.' }

  let result: { count: number }
  try {
    result = await db.purchase.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', adminRemarks: reason, reviewedById: auth.userId, reviewedAt: new Date() },
    })
  } catch (err) {
    console.error('[rejectPurchase] DB error:', err)
    return { error: 'A database error occurred. Please try again.' }
  }
  if (result.count === 0) return { error: 'This purchase has already been processed.' }

  revalidatePath('/admin/purchases')

  try {
    await sendPurchaseRejectionEmail({ to: purchase.user.email, firstName: purchase.user.firstName, reason })
  } catch (err) {
    console.error('[rejectPurchase] Email error:', err)
    return { error: 'Purchase rejected but notification email failed.', success: true }
  }

  redirect('/admin/purchases')
}
