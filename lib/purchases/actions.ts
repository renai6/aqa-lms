'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validateImageUpload } from '@/lib/uploads/image'
import { createPurchaseSchema } from '@/lib/purchases/schema'
import { getPurchasableCourses } from '@/lib/purchases/queries'
import { sendPurchaseConfirmationEmail } from '@/lib/purchases/email'

type ActionState = { error: string | null }

export async function createPurchaseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession()
  if (!session || session.role !== 'STUDENT') return { error: 'Unauthorized' }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true, firstName: true, studentType: true },
  })
  if (!user) return { error: 'Account not found.' }

  const raw = {
    courseIds: formData.getAll('courseIds').map(String),
    paymentType: formData.get('paymentType'),
    amountPaid: formData.get('amountPaid'),
    studentType: user.studentType ?? 'OLD',
  }
  const result = createPurchaseSchema.safeParse(raw)
  if (!result.success) return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  const { courseIds, paymentType, amountPaid } = result.data

  // Re-validate every selected course is still purchasable for this user.
  const purchasable = new Set((await getPurchasableCourses(session.userId)).map((c) => c.id))
  const invalid = courseIds.filter((id) => !purchasable.has(id))
  if (invalid.length > 0) {
    return { error: 'One or more selected courses are no longer available for purchase.' }
  }

  // Validate and upload the proof image.
  const image = await validateImageUpload(formData.get('file'))
  if (!image.ok) return { error: image.error }

  let purchaseId: string
  try {
    const purchase = await db.purchase.create({
      data: {
        userId: session.userId,
        paymentType,
        amountPaid,
        paymentProofUrl: '', // set after upload
        items: { create: courseIds.map((courseId) => ({ courseId })) },
      },
      select: { id: true },
    })
    purchaseId = purchase.id
  } catch (err) {
    console.error('[createPurchase] DB error:', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  const storagePath = `proof/${purchaseId}/proof.${image.ext}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .upload(storagePath, image.buffer, { contentType: image.contentType, upsert: true })
  if (uploadError) {
    console.error('[createPurchase] Supabase error:', uploadError)
    await db.purchase.delete({ where: { id: purchaseId } }).catch(() => {})
    return { error: 'Failed to upload payment proof. Please try again.' }
  }

  try {
    await db.purchase.update({ where: { id: purchaseId }, data: { paymentProofUrl: storagePath } })
  } catch (err) {
    console.error('[createPurchase] DB error (proof url):', err)
    return { error: 'Payment uploaded but could not be saved. Please contact support.' }
  }

  try {
    await sendPurchaseConfirmationEmail({ to: user.email, firstName: user.firstName, purchaseId })
  } catch (err) {
    console.error('[createPurchase] Email error:', err)
  }

  redirect('/student/dashboard')
}
