import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { CreateUserForm } from './create-user-form'

type Props = { searchParams: Promise<{ role?: string }> }

export async function generateMetadata({ searchParams }: Props) {
  const { role } = await searchParams
  const label = role === 'TEACHER' ? 'Teacher' : 'Admin'
  return { title: `New ${label} — AQA Admin` }
}

export default async function NewUserPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { role: rawRole } = await searchParams
  const role = rawRole === 'TEACHER' ? 'TEACHER' : 'ADMIN'
  const roleLabel = role === 'TEACHER' ? 'Teacher' : 'Admin'
  const backTab = role === 'TEACHER' ? 'teachers' : 'admins'

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link
        href={'/admin/users?tab=' + backTab}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Users
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">New {roleLabel}</h1>
        <p className="text-muted-foreground mt-1">
          Create a {roleLabel.toLowerCase()} account. Credentials will be emailed automatically.
        </p>
      </div>
      <CreateUserForm role={role} roleLabel={roleLabel} />
    </div>
  )
}
