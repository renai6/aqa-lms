import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth/jwt'
import type { UserRole } from '@/lib/auth/types'

const ROLE_DASHBOARDS: Record<UserRole, string> = {
  SUPER_ADMIN: '/admin/dashboard',
  ADMIN: '/admin/dashboard',
  TEACHER: '/teacher/dashboard',
  STUDENT: '/student/dashboard',
}

const PROTECTED: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: '/admin', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { prefix: '/teacher', roles: ['TEACHER'] },
  { prefix: '/student', roles: ['STUDENT'] },
]

const AUTH_PATHS = ['/login', '/forgot-password', '/reset-password', '/verify-email']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('session')?.value
  const payload = token ? await verifySessionToken(token) : null

  if (AUTH_PATHS.some((p) => pathname.startsWith(p)) && payload) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARDS[payload.role], request.url))
  }

  const match = PROTECTED.find((p) => pathname.startsWith(p.prefix))
  if (!match) return NextResponse.next()

  if (!payload) {
    const res = NextResponse.redirect(new URL('/login', request.url))
    res.cookies.delete('session')
    return res
  }

  if (!match.roles.includes(payload.role)) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARDS[payload.role], request.url))
  }

  const res = NextResponse.next()
  res.headers.set('x-user-id', payload.sub)
  res.headers.set('x-user-role', payload.role)
  return res
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/teacher/:path*',
    '/student/:path*',
    '/login',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ],
}
