import { getSession } from '@/lib/auth/session'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  return (
    <div data-user-id={session?.userId} data-user-role={session?.role}>
      {children}
    </div>
  )
}
