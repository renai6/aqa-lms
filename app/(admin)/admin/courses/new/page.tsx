import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { CreateCourseForm } from './create-course-form'

export const metadata = { title: 'New Course — AQA Admin' }

export default function NewCoursePage() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link href="/admin/courses" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Courses
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">New Course</h1>
        <p className="text-muted-foreground mt-1">Create a new course for students to enroll in.</p>
      </div>
      <CreateCourseForm />
    </div>
  )
}
