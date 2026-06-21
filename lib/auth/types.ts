export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT'

export type SessionPayload = {
  sub: string
  role: UserRole
  email: string
  mustChangePassword: boolean
}
