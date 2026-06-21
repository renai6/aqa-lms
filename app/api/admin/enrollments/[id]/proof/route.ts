import { type NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // 1. Await params (Next.js 16: params is a Promise)
  const { id } = await params

  // 2. Auth guard: getSession() — return 401 if null, 403 if role is not ADMIN or SUPER_ADMIN
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Fetch the enrollment request from DB
  const enrollmentRequest = await db.enrollmentRequest.findUnique({
    where: { id },
    select: { paymentProofUrl: true },
  })

  if (!enrollmentRequest || !enrollmentRequest.paymentProofUrl) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 4. Generate signed URL with 5-minute TTL (300 seconds)
  const { data, error } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .createSignedUrl(enrollmentRequest.paymentProofUrl, 300)

  if (error) {
    console.error('[proof/route] Supabase signed URL error:', error)
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    )
  }

  // 6. Return NextResponse.json({ signedUrl })
  return NextResponse.json({ signedUrl: data.signedUrl })
}
