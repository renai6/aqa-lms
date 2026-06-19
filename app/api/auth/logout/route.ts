import { type NextRequest, NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  await clearSession()
  return NextResponse.redirect(new URL('/login', request.url))
}
