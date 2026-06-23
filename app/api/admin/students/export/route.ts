// app/api/admin/students/export/route.ts
import { type NextRequest } from 'next/server'
import { type Gender } from '@prisma/client'
import { getStudents } from '@/lib/students/queries'

export async function GET(request: NextRequest) {
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
    const name = `"${s.firstName} ${s.lastName}"`
    const email = `"${s.email}"`
    const genderLabel = s.gender ? (s.gender === 'MALE' ? 'Male' : 'Female') : ''
    const courses = `"${s.enrollments.map((e) => e.courseTitle).join('; ')}"`
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
