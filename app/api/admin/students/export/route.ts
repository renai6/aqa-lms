// app/api/admin/students/export/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { type Gender } from '@prisma/client'
import { verifySessionToken } from '@/lib/auth/jwt'
import { getStudents } from '@/lib/students/queries'

function csvSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export async function GET(request: NextRequest) {
  // Auth guard: verify JWT cookie directly (middleware excludes /api/*)
  const token = request.cookies.get('session')?.value
  const payload = token ? await verifySessionToken(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const course = searchParams.get('course') ?? undefined
  const genderParam = searchParams.get('gender')
  const gender =
    genderParam === 'MALE' || genderParam === 'FEMALE'
      ? (genderParam as Gender)
      : undefined

  const students = await getStudents({ courseId: course, gender })

  const header = 'Name,Email,Gender,Course,Enrolled Date,Status\r\n'
  const rows = students.map((s) => {
    const name = `"${csvSafe(`${s.firstName} ${s.lastName}`)}"`
    const email = `"${csvSafe(s.email)}"`
    const genderLabel = s.gender ? (s.gender === 'MALE' ? 'Male' : 'Female') : ''
    const courses = `"${csvSafe(s.enrollments.map((e) => e.courseTitle).join('; '))}"`
    const enrolledDate = s.enrollments[0]
      ? s.enrollments[0].enrolledAt.toISOString().slice(0, 10)
      : ''
    const status = s.isActive ? 'Active' : 'Inactive'
    return [name, email, genderLabel, courses, enrolledDate, status].join(',')
  })

  const csv = header + rows.join('\r\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="students.csv"',
    },
  })
}
