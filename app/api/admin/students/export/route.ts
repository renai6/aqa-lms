// app/api/admin/students/export/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { type Gender } from '@prisma/client'
import { verifySessionToken } from '@/lib/auth/jwt'
import { getAllStudents } from '@/lib/students/queries'
import { formatEnrolledCourses } from '@/lib/students/format'

// Quotes a value for CSV, escaping embedded quotes and neutralising anything a
// spreadsheet would treat as a formula.
function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
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

  const students = await getAllStudents({ courseId: course, gender })

  const header =
    'Name,Email,Mobile Number,Facebook Name,Facebook Link,Gender,Course,Enrolled Date,Status\r\n'
  const rows = students.map((s) => {
    const name = csvField(`${s.firstName} ${s.lastName}`)
    const email = csvField(s.email)
    const mobileNumber = csvField(s.contactNumber ?? '')
    const facebookName = csvField(s.facebookName ?? '')
    const facebookLink = csvField(s.facebookLink ?? '')
    const genderLabel = s.gender ? (s.gender === 'MALE' ? 'Male' : 'Female') : ''
    const courses = csvField(formatEnrolledCourses(s.enrollments))
    const enrolledDate = s.enrollments[0]
      ? s.enrollments[0].enrolledAt.toISOString().slice(0, 10)
      : ''
    const status = s.isActive ? 'Active' : 'Inactive'
    return [
      name,
      email,
      mobileNumber,
      facebookName,
      facebookLink,
      genderLabel,
      courses,
      enrolledDate,
      status,
    ].join(',')
  })

  const csv = header + rows.join('\r\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="students.csv"',
    },
  })
}
