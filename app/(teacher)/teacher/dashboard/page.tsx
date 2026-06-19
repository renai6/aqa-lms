import { getSession } from '@/lib/auth/session'

export default async function TeacherDashboardPage() {
  const session = await getSession()
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
      <p className="text-muted-foreground mt-1">Signed in as {session?.role}</p>
    </main>
  )
}
