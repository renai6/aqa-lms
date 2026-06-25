import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getCheckoutCourses } from '@/lib/purchases/queries'
import { CheckoutForm } from './checkout-form'

export const metadata = { title: 'Checkout — AQA' }

type Props = { searchParams: Promise<{ ids?: string }> }

export default async function CheckoutPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session || session.role !== 'STUDENT') redirect('/login')

  const { ids } = await searchParams
  const courseIds = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (courseIds.length === 0) redirect('/student/courses')

  const [courses, user] = await Promise.all([
    getCheckoutCourses(session.userId, courseIds),
    db.user.findUnique({ where: { id: session.userId }, select: { studentType: true } }),
  ])
  if (courses.length === 0) redirect('/student/courses')

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>
      <p className="text-muted-foreground text-sm mt-1">
        Review your selection, then upload your proof of payment.
      </p>
      <div className="mt-6">
        <CheckoutForm courses={courses} studentType={user?.studentType ?? 'OLD'} />
      </div>
    </div>
  )
}
