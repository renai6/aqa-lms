import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCourseById } from '@/lib/courses/queries'
import { getSession } from '@/lib/auth/session'
import { CreateSubjectForm } from './create-subject-form'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const course = await getCourseById(id)
  return { title: course ? 'New Subject — ' + course.title + ' — AQA Admin' : 'New Subject — AQA Admin' }
}

export default async function NewSubjectPage({ params }: Props) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const course = await getCourseById(id)
  if (!course) notFound()

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link
        href={'/admin/courses/' + id + '/subjects'}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Subjects
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">New Subject</h1>
        <p className="text-muted-foreground mt-1">{course.title}</p>
      </div>
      <CreateSubjectForm courseId={id} nextOrder={course.subjects.length + 1} />
    </div>
  )
}
