import { redirect } from 'next/navigation'
import { getAccountSession, getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { StudentNav } from '@/components/student/nav'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const [account, session] = await Promise.all([getAccountSession(), getSession()])
  if (!account || !session || account.role !== 'STUDENT') redirect('/login')

  // isActive is re-checked on every student page load: sessions are stateless
  // 7-day JWTs, so an admin deactivating a student mid-session would otherwise
  // not take effect until the token expired. It is the account that is checked;
  // getSession already resolves only active kids.
  const user = await db.user.findUnique({
    where: { id: account.userId },
    select: {
      firstName: true,
      isActive: true,
      dependents: { where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true, firstName: true } },
    },
  })
  if (!user?.isActive) redirect('/login')

  const activeKidId = session.userId === account.userId ? null : session.userId

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <StudentNav self={{ firstName: user.firstName }} kids={user.dependents} activeKidId={activeKidId} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
