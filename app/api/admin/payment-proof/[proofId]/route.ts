import { type NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { verifySessionToken } from '@/lib/auth/jwt'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proofId: string }> }
): Promise<NextResponse> {
  const { proofId } = await params

  const token = req.cookies.get('session')?.value
  const payload = token ? await verifySessionToken(token) : null
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const proof = await db.paymentProof.findUnique({
    where: { id: proofId },
    select: { proofUrl: true },
  })
  if (!proof) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .createSignedUrl(proof.proofUrl, 300)

  if (error) return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })

  return NextResponse.json({ signedUrl: data.signedUrl })
}
