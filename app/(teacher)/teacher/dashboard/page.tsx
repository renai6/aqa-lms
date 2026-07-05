import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, ClipboardCheck } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import {
  getTeacherSubjects,
  countTeacherPendingGrading,
} from '@/lib/teacher/queries'
import { PageHeader } from '@/components/admin/page-header'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Dashboard — AQA Teacher' }

export default async function TeacherDashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [subjects, pendingGrading] = await Promise.all([
    getTeacherSubjects(session.userId),
    countTeacherPendingGrading(session.userId),
  ])

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Dashboard" />

      <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
              <BookOpen className="text-primary h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl leading-none font-semibold">
                {subjects.length}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {subjects.length === 1 ? 'Subject' : 'Subjects'} assigned
              </p>
            </div>
          </CardContent>
        </Card>
        <Link href="/teacher/subjects" className="block">
          <Card className="hover:border-primary/40 transition-colors">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-100">
                <ClipboardCheck
                  className="h-5 w-5 text-amber-700"
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="text-2xl leading-none font-semibold">
                  {pendingGrading}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {pendingGrading === 1 ? 'Attempt' : 'Attempts'} awaiting
                  grading
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
