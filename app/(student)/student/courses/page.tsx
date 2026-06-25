import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { getPurchasableCourses } from '@/lib/purchases/queries'
import { CourseCart } from './cart'

export const metadata = { title: 'Browse Courses — AQA' }

export default async function StudentCoursesPage() {
  const session = await getSession()
  if (!session || session.role !== 'STUDENT') redirect('/login')

  const courses = await getPurchasableCourses(session.userId)

  return (
    <div className="px-6 md:px-10 py-8">
      <CourseCart courses={courses} />
    </div>
  )
}
