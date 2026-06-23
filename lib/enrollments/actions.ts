'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendEnrollmentConfirmationEmail } from './email'

type ActionState = { error: string | null; success?: boolean }

// ─── submitEnrollmentAction ───────────────────────────────────────────────────

const enrollSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required.'),
    lastName: z.string().min(1, 'Last name is required.'),
    email: z.string().email('A valid email address is required.'),
    courseId: z.string().min(1, 'Course is required.'),
    gender: z.enum(['MALE', 'FEMALE'], { error: 'Gender is required.' }),
    address: z.string().trim().min(1, 'Address is required.'),
    contactNumber: z.string().trim().regex(
      /^(09\d{9}|\+639\d{9})$/,
      'Enter a valid PH mobile number (e.g. 09XXXXXXXXX).',
    ),
    facebookName: z.string().trim().min(1, 'Facebook name is required.'),
    facebookLink: z
      .string()
      .url('Enter a valid URL.')
      .refine((u) => u.startsWith('https://'), 'Link must use HTTPS.'),
    studentType: z.enum(['NEW', 'OLD'], { error: 'Student type is required.' }),
    paymentType: z.enum(['PARTIAL', 'FULL'], { error: 'Payment type is required.' }),
    amountPaid: z.coerce.number().positive('Amount paid must be greater than 0.'),
  })
  .refine((data) => !(data.studentType === 'NEW' && data.paymentType !== 'FULL'), {
    message: 'New students must pay in full.',
    path: ['paymentType'],
  })

export async function submitEnrollmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    courseId: formData.get('courseId'),
    gender: formData.get('gender'),
    address: formData.get('address'),
    contactNumber: formData.get('contactNumber'),
    facebookName: formData.get('facebookName'),
    facebookLink: formData.get('facebookLink'),
    studentType: formData.get('studentType'),
    paymentType: formData.get('paymentType'),
    amountPaid: formData.get('amountPaid'),
  }

  const result = enrollSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  const { firstName, lastName, email, courseId, gender, address, contactNumber, facebookName, facebookLink, studentType, paymentType, amountPaid } = result.data

  const course = await db.course.findFirst({
    where: { id: courseId, isPublished: true },
    select: { title: true },
  })
  if (!course) return { error: 'Course not found.' }

  const duplicate = await db.enrollmentRequest.findFirst({
    where: { email, courseId, status: { in: ['PENDING', 'APPROVED'] } },
  })
  if (duplicate) return { error: 'You have already applied for this course.' }

  let requestId: string
  try {
    const request = await db.enrollmentRequest.create({
      data: {
        firstName,
        lastName,
        email,
        courseId,
        gender,
        address,
        contactNumber,
        facebookName,
        facebookLink,
        studentType,
        paymentType,
        amountPaid,
      },
    })
    requestId = request.id
  } catch (err) {
    console.error('[submitEnrollment] DB error:', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  // Email failure does not block the flow — request is already created
  try {
    await sendEnrollmentConfirmationEmail({ to: email, firstName, courseName: course.title, requestId })
  } catch (err) {
    console.error('[submitEnrollment] Email error:', err)
  }

  redirect('/enroll/' + requestId)
}

// ─── uploadProofAction ────────────────────────────────────────────────────────

export async function uploadProofAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const requestId = formData.get('requestId')
  if (typeof requestId !== 'string' || !requestId) {
    return { error: 'Invalid request ID.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Please select a file to upload.' }
  }

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'Only JPG, PNG, and WEBP images are accepted.' }
  }

  const MAX_SIZE = 5 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return { error: 'File size must be 5MB or less.' }
  }

  const request = await db.enrollmentRequest.findUnique({
    where: { id: requestId },
    select: { status: true },
  })
  if (!request) return { error: 'Enrollment request not found.' }
  if (request.status === 'APPROVED' || request.status === 'REJECTED') {
    return { error: 'This enrollment request has already been processed.' }
  }

  const EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const storagePath = `proof/${requestId}/proof.${EXT[file.type]}`
  const buffer = Buffer.from(await file.arrayBuffer())

  // Verify actual file content matches declared type via magic bytes
  const header = new Uint8Array(buffer.slice(0, 12))
  const isJpeg = header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF
  const isPng =
    header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47
  const isWebp =
    header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
    header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50
  if (!isJpeg && !isPng && !isWebp) {
    return { error: 'Invalid image file. Only JPG, PNG, and WEBP images are accepted.' }
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error('[uploadProof] Supabase error:', uploadError)
    return { error: 'Failed to upload file. Please try again.' }
  }

  try {
    await db.enrollmentRequest.update({
      where: { id: requestId },
      data: { paymentProofUrl: storagePath },
    })
  } catch (err) {
    console.error('[uploadProof] DB error:', err)
    return { error: 'File uploaded but record could not be saved. Please contact support.' }
  }

  return { error: null, success: true }
}
