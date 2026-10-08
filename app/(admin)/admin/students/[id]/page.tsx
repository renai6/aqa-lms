// app/(admin)/admin/students/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getStudentById } from '@/lib/students/queries'
import { PageHeader } from '@/components/admin/page-header'
import { DeactivateStudentButton } from '../deactivate-student-button'
import { RemoveEnrollmentButton } from '@/components/admin/remove-enrollment-button'
import { MoveEnrollmentCourseButton } from '@/components/admin/move-enrollment-course-button'
import { getCourseMoveTargets } from '@/lib/enrollments/move-targets'
import { courseMoveOptions } from '@/lib/enrollments/move-options'
import { isMovedAway } from '@/lib/enrollments/moved'
import { cn } from '@/lib/utils'

type Props = { params: Promise<{ id: string }> }

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default async function StudentDetailPage({ params }: Props) {
  const { id } = await params
  const [student, moveTargets] = await Promise.all([
    getStudentById(id),
    getCourseMoveTargets(),
  ])
  if (!student) notFound()

  const activeCourseIds = student.enrollments
    .filter((e) => !e.removedAt)
    .map((e) => e.courseId)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        breadcrumbs={[
          { label: 'Students', href: '/admin/students' },
          { label: `${student.firstName} ${student.lastName}` },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enrollments — main area */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Enrollments
          </h2>
          {student.enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No enrollments.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Course</th>
                    <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Enrolled</th>
                    <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Progress</th>
                    <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Payment</th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {student.enrollments.map((e) => (
                    <tr
                      key={e.courseId}
                      className={cn(
                        'hover:bg-muted/50 transition-colors',
                        e.removedAt && 'text-muted-foreground bg-muted/30',
                      )}
                    >
                      <td className="px-4 py-3 font-medium">
                        {e.courseTitle}
                        {e.removedAt && (
                          <>
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                              Removed
                            </span>
                            <p className="text-xs mt-0.5 font-normal">
                              {dateFormatter.format(e.removedAt)}
                              {e.removedReason && ` - ${e.removedReason}`}
                            </p>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {dateFormatter.format(e.enrolledAt)}
                      </td>
                      <td className="px-4 py-3">{e.progress}%</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium',
                          e.removedAt
                            ? 'bg-muted text-muted-foreground'
                            : e.paymentStatus === 'FULLY_PAID'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800',
                        )}>
                          {e.paymentStatus === 'FULLY_PAID' ? 'Fully Paid' : 'Partially Paid'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {/* Stacked, not side by side: this table shares the page
                            with the profile sidebar, and two buttons in a row
                            push the last one past the table's clipped edge. */}
                        <div className="flex flex-col items-end gap-2">
                          {!e.removedAt && !e.hasCertificate && (
                            <MoveEnrollmentCourseButton
                              enrollmentId={e.id}
                              studentName={`${student.firstName} ${student.lastName}`}
                              courseTitle={e.courseTitle}
                              totalDue={e.totalDue}
                              courses={courseMoveOptions(moveTargets, {
                                courseId: e.courseId,
                                paymentFrequency: e.paymentFrequency,
                                activeCourseIds,
                              })}
                            />
                          )}
                          {/* A row moved to another course has no restore: its
                              payments left with the student. */}
                          {!(e.removedAt && isMovedAway(e.removedReason)) && (
                            <RemoveEnrollmentButton
                              enrollmentId={e.id}
                              studentName={`${student.firstName} ${student.lastName}`}
                              courseTitle={e.courseTitle}
                              isRemoved={e.removedAt !== null}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Profile — sidebar */}
        <div className="border rounded-lg p-4 space-y-3 self-start">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Profile
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Full name</dt>
              <dd className="font-medium mt-0.5">{student.firstName} {student.lastName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email{student.parentName && ' (parent)'}</dt>
              <dd className="mt-0.5 break-all">{student.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contact number{student.parentName && ' (parent)'}</dt>
              <dd className="mt-0.5">{student.contactNumber ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Address</dt>
              <dd className="mt-0.5 whitespace-pre-line">{student.address ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Facebook/Messenger</dt>
              <dd className="mt-0.5 break-all">
                {student.facebookLink?.startsWith('https://') ? (
                  <a
                    href={student.facebookLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {student.facebookName ?? student.facebookLink}
                  </a>
                ) : (
                  student.facebookName ?? '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Gender</dt>
              <dd className="mt-0.5">
                {student.gender ? (student.gender === 'MALE' ? 'Male' : 'Female') : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Student type</dt>
              <dd className="mt-0.5">
                {student.studentType
                  ? student.studentType === 'NEW' ? 'New student' : 'Old student'
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-0.5 space-y-2">
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  student.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {student.isActive ? 'Active' : 'Inactive'}
                </span>
                <DeactivateStudentButton
                  studentId={student.id}
                  isActive={student.isActive}
                  studentName={`${student.firstName} ${student.lastName}`}
                />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="mt-0.5">{dateFormatter.format(student.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
