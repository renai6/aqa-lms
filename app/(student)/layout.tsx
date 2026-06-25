import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { StudentNav } from '@/components/student/nav'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || session.role !== 'STUDENT') redirect('/login')

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true },
  })

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <StudentNav firstName={user?.firstName ?? ''} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
