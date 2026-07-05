import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getTeacherSubject, getSubjectGradebook } from '@/lib/teacher/queries'
import { PageHeader } from '@/components/admin/page-header'
import { SubjectTabs } from '../subject-tabs'
import { FinalGradeForm } from './final-grade-form'

type Props = { params: Promise<{ sid: string }> }

export const metadata = { title: 'Grades — AQA Teacher' }

function fmt(score: number | null): string {
  return score == null ? '—' : score.toFixed(1) + '%'
}

export default async function TeacherSubjectGradesPage({ params }: Props) {
  const { sid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const [subject, gradebook] = await Promise.all([
    getTeacherSubject(session.userId, sid),
    getSubjectGradebook(session.userId, sid),
  ])
  if (!subject || !gradebook) notFound()

  const base = '/teacher/subjects/' + sid

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumbs={[
          { label: 'My Subjects', href: '/teacher/subjects' },
          { label: subject.courseTitle },
          { label: subject.title },
        ]}
        title={subject.title}
      />
      <SubjectTabs subjectId={sid} />

      <p className="text-muted-foreground text-sm">
        Assessment scores use each student&apos;s latest completed attempt. The
        final grade is a weighted average (by assessment weight) you can
        override. Passing grade: {gradebook.passingGrade}%.
      </p>

      {gradebook.students.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border py-8 text-center text-sm">
          No students enrolled in this course yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th
                  scope="col"
                  className="text-muted-foreground bg-muted sticky left-0 px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Student
                </th>
                {gradebook.assessments.map((a) => (
                  <th
                    key={a.id}
                    scope="col"
                    className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide whitespace-nowrap uppercase"
                  >
                    {a.title}
                    <span className="block text-[10px] font-normal normal-case">
                      ×{a.weight}
                    </span>
                  </th>
                ))}
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Suggested
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Final Grade
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {gradebook.students.map((s) => (
                <tr
                  key={s.studentId}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <td className="bg-background sticky left-0 px-4 py-3 font-medium whitespace-nowrap">
                    {s.studentName}
                  </td>
                  {s.scores.map((score, i) => (
                    <td
                      key={gradebook.assessments[i].id}
                      className="text-muted-foreground px-4 py-3 whitespace-nowrap"
                    >
                      {fmt(score)}
                    </td>
                  ))}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {s.suggestion == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={
                          s.suggestion >= gradebook.passingGrade
                            ? 'text-green-600'
                            : 'text-destructive'
                        }
                      >
                        {s.suggestion.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <FinalGradeForm
                      subjectId={sid}
                      studentId={s.studentId}
                      basePath={base}
                      suggestion={s.suggestion}
                      savedGrade={s.savedGrade}
                      diverges={s.diverges}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
