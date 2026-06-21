import type { UserRole } from './types'

export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  SUPER_ADMIN: '/admin/dashboard',
  ADMIN: '/admin/dashboard',
  TEACHER: '/teacher/dashboard',
  STUDENT: '/student/dashboard',
}
