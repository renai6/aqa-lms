// app/(admin)/admin/students/page.tsx
import { Suspense } from 'react'
import { type Gender } from '@prisma/client'
import { db } from '@/lib/db'
import { getStudents } from '@/lib/students/queries'
import { PageHeader } from '@/components/admin/page-header'
import { FilterBar } from './filter-bar'
import { StudentTable } from './student-table'

type Props = {
  searchParams: Promise<{ course?: string; gender?: string }>
}

export const metadata = { title: 'Students — AQA Admin' }

export default async function StudentsPage({ searchParams }: Props) {
  const { course, gender } = await searchParams

  const validGender =
    gender === 'MALE' || gender === 'FEMALE' ? (gender as Gender) : undefined

  const [students, courses] = await Promise.all([
    getStudents({ courseId: course, gender: validGender }),
    db.course.findMany({
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    }),
  ])

  const exportParams = new URLSearchParams()
  if (course) exportParams.set('course', course)
  if (validGender) exportParams.set('gender', validGender)
  const exportHref =
    '/api/admin/students/export' +
    (exportParams.size ? '?' + exportParams.toString() : '')

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <PageHeader title="Students" />
      <Suspense fallback={null}>
        <FilterBar
          courses={courses}
          currentCourse={course}
          currentGender={gender}
          exportHref={exportHref}
        />
      </Suspense>
      <StudentTable students={students} />
    </div>
  )
}
