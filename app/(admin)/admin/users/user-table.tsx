import { cn } from '@/lib/utils'
import { ToggleActiveButton } from './toggle-active-button'
import type { UserRow } from '@/lib/users/queries'

type Props = {
  users: UserRow[]
  role: 'admins' | 'teachers'
}

export function UserTable({ users, role }: Props) {
  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">No {role} yet.</p>
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Email</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Created</th>
            <th scope="col" aria-label="Actions" className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-muted/50 transition-colors">
              <td className="px-4 py-3 font-medium">{u.firstName} {u.lastName}</td>
              <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                    u.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-zinc-100 text-zinc-600',
                  )}
                >
                  {u.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs">
                {u.createdAt.toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <ToggleActiveButton userId={u.id} isActive={u.isActive} userName={`${u.firstName} ${u.lastName}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
