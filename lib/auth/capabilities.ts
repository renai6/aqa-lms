import { db } from '@/lib/db'
import type { UserRole } from '@/lib/auth/types'

type SessionLike = { userId: string; role: UserRole }

// Capability check shared by admin and teacher assessment/grading actions.
// SUPER_ADMIN and ADMIN can manage any subject; a TEACHER can only manage a
// subject they are assigned to via SubjectTeacher.
export async function canManageSubject(
  session: SessionLike | null,
  subjectId: string,
): Promise<boolean> {
  if (!session) return false
  if (session.role === 'SUPER_ADMIN' || session.role === 'ADMIN') return true
  if (session.role === 'TEACHER') {
    const assignment = await db.subjectTeacher.findUnique({
      where: { subjectId_userId: { subjectId, userId: session.userId } },
      select: { subjectId: true },
    })
    return assignment != null
  }
  return false
}

// Throwing variant for code paths that prefer to fail hard (e.g. after the
// caller has already validated the request shape).
export async function assertCanManageSubject(
  session: SessionLike | null,
  subjectId: string,
): Promise<void> {
  if (!(await canManageSubject(session, subjectId))) {
    throw new Error('Forbidden')
  }
}

// Is this session a student who is still allowed in?
// Deactivation flips User.isActive, but sessions are stateless 7-day JWTs, so
// every student entry point has to re-check the flag rather than trust the token.
export async function isActiveStudent(session: SessionLike | null): Promise<boolean> {
  if (!session) return false

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { isActive: true },
  })

  return user?.isActive === true
}
