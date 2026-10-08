import { redirect } from 'next/navigation'
import { getAccountSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { KidForm } from '@/components/students/kid-form'
import { KidList } from '@/components/students/kid-list'
import { addKidAction, removeKidAction, updateKidAction } from '@/lib/students/dependent-actions'

export const metadata = { title: 'My Kids - AQA' }

export default async function KidsPage() {
  // The account's kids, even while one of them is the selected profile.
  const account = await getAccountSession()
  if (!account || account.role !== 'STUDENT') redirect('/login')

  // A linked kid logs in as themselves, and kids cannot have kids.
  const self = await db.user.findUnique({ where: { id: account.userId }, select: { guardianId: true } })
  if (self?.guardianId) redirect('/student/dashboard')

  const kids = await db.user.findMany({
    where: { guardianId: account.userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gender: true,
      isActive: true,
      email: true,
      _count: { select: { purchases: true, enrollments: true } },
    },
  })

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">My Kids</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Add a profile for each child you enroll. Switch to their profile from the menu at the top to enroll them,
        join their classes, watch recordings and take quizzes for them.
      </p>

      <section className="mt-6">
        <KidList
          kids={kids.map(({ _count, email, ...k }) => ({
            ...k,
            removable: _count.purchases + _count.enrollments === 0 && !email,
          }))}
          updateAction={updateKidAction}
          removeAction={removeKidAction}
        />
        <p className="text-muted-foreground mt-2 text-xs">
          A kid who has enrolled, purchased a course, or has their own login cannot be removed. Contact the academy if you need changes.
        </p>
      </section>

      <section className="mt-8 rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">Add a kid</h2>
        <KidForm action={addKidAction} submitLabel="Add kid" />
      </section>
    </div>
  )
}
