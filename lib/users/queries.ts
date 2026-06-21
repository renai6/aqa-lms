import { db } from '@/lib/db'

export type UserRow = {
  id: string
  firstName: string
  lastName: string
  email: string
  isActive: boolean
  createdAt: Date
}

export async function getUsersByRole(role: 'ADMIN' | 'TEACHER'): Promise<UserRow[]> {
  return db.user.findMany({
    where: { role },
    orderBy: { lastName: 'asc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
  })
}
