'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

type ActionState = { error: string | null; success?: boolean }

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MAX_SIZE = 5 * 1024 * 1024

function validateImageMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const h = new Uint8Array(buffer.slice(0, 12))
  if (mimeType === 'image/jpeg') return h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF
  if (mimeType === 'image/png') return h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47
  if (mimeType === 'image/webp') {
    return h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 &&
      h[8] === 0x57 && h[9] === 0x45 && h[10] === 0x42 && h[11] === 0x50
  }
  return false
}

export async function submitAdditionalPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'STUDENT') return { error: 'Forbidden' }

  const enrollmentIdRaw = formData.get('enrollmentId')
  if (typeof enrollmentIdRaw !== 'string' || !enrollmentIdRaw) {
    return { error: 'Invalid enrollment.' }
  }

  const amountRaw = formData.get('amount')
  const amount = parseFloat(typeof amountRaw === 'string' ? amountRaw : '')
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Amount must be greater than 0.' }
  }

  const noteRaw = formData.get('note')
  const note = typeof noteRaw === 'string' && noteRaw.trim() ? noteRaw.trim() : null

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Please select a file to upload.' }
  if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
    return { error: 'Only JPG, PNG, and WEBP images are accepted.' }
  }
  if (file.size > MAX_SIZE) return { error: 'File size must be 5MB or less.' }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (!validateImageMagicBytes(buffer, file.type)) {
    return { error: 'Invalid image file. Only JPG, PNG, and WEBP images are accepted.' }
  }

  const enrollment = await db.enrollment.findFirst({
    where: { id: enrollmentIdRaw, userId: session.userId },
    select: { id: true, paymentStatus: true },
  })
  if (!enrollment) return { error: 'Enrollment not found.' }
  if (enrollment.paymentStatus === 'FULLY_PAID') {
    return { error: 'Your enrollment is already fully paid.' }
  }

  const timestamp = Date.now()
  const ext = EXT[file.type]
  const storagePath = `proof/${enrollment.id}/${timestamp}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[additionalPayment] Supabase error:', uploadError)
    return { error: 'Failed to upload file. Please try again.' }
  }

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.paymentProof.create({
        data: { enrollmentId: enrollment.id, proofUrl: storagePath, amount, note },
      })
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { totalPaid: { increment: amount } },
      })
    })
  } catch (err) {
    console.error('[additionalPayment] DB error:', err)
    return { error: 'File uploaded but record could not be saved. Please contact support.' }
  }

  revalidatePath('/student/dashboard')
  return { error: null, success: true }
}
