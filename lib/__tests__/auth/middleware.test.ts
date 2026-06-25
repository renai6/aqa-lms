import { describe, it, expect, vi, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/jwt', () => ({
  verifySessionToken: vi.fn(),
}))

import { verifySessionToken } from '@/lib/auth/jwt'
import { proxy } from '@/proxy'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-characters!!'
})

function makeRequest(path: string, sessionToken?: string) {
  const url = `http://localhost${path}`
  const req = new NextRequest(url)
  if (sessionToken) req.cookies.set('session', sessionToken)
  return req
}

describe('middleware', () => {
  it('redirects unauthenticated request on /admin to /login', async () => {
    vi.mocked(verifySessionToken).mockResolvedValue(null)
    const res = await proxy(makeRequest('/admin/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('redirects authenticated STUDENT visiting /admin to /student/dashboard', async () => {
    vi.mocked(verifySessionToken).mockResolvedValue({
      sub: 'u1', role: 'STUDENT', email: 'x@x.com', mustChangePassword: false,
    })
    const res = await proxy(makeRequest('/admin/dashboard', 'some-token'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/student/dashboard')
  })

  it('forwards user headers for valid ADMIN on /admin', async () => {
    vi.mocked(verifySessionToken).mockResolvedValue({
      sub: 'u2', role: 'ADMIN', email: 'admin@x.com', mustChangePassword: false,
    })
    const res = await proxy(makeRequest('/admin/dashboard', 'valid-token'))
    expect(res.headers.get('x-user-id')).toBe('u2')
    expect(res.headers.get('x-user-role')).toBe('ADMIN')
  })

  it('redirects authenticated user away from /login to their dashboard', async () => {
    vi.mocked(verifySessionToken).mockResolvedValue({
      sub: 'u3', role: 'TEACHER', email: 't@x.com', mustChangePassword: false,
    })
    const res = await proxy(makeRequest('/login', 'valid-token'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/teacher/dashboard')
  })

  it('redirects an authenticated user away from /register', async () => {
    vi.mocked(verifySessionToken).mockResolvedValue({
      sub: 'u1', role: 'STUDENT', email: 'x@x.com', mustChangePassword: false,
    })
    const res = await proxy(makeRequest('/register', 'some-token'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/student/dashboard')
  })

  it('allows an unauthenticated user to reach /register', async () => {
    vi.mocked(verifySessionToken).mockResolvedValue(null)
    const res = await proxy(makeRequest('/register'))
    expect(res.status).toBe(200)
  })
})
