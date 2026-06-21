'use client'

import { useActionState } from 'react'
import { assignTeacherAction, removeTeacherAction } from '../../actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TeacherRow, TeacherOption } from '@/lib/courses/queries'

type Props = {
  subjectId: string
  courseId: string
  currentTeachers: TeacherRow[]
  allTeachers: TeacherOption[]
}

export function TeacherAssignmentPanel({
  subjectId,
  courseId,
  currentTeachers,
  allTeachers,
}: Props) {
  const assignedIds = new Set(currentTeachers.map((t) => t.userId))
  const available = allTeachers.filter((t) => !assignedIds.has(t.id))

  const [assignState, assignFormAction, assignPending] = useActionState(assignTeacherAction, {
    error: null,
  })
  const [removeState, removeFormAction, removePending] = useActionState(removeTeacherAction, {
    error: null,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teachers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentTeachers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teachers assigned.</p>
        ) : (
          <ul className="space-y-2">
            {currentTeachers.map((t) => (
              <li key={t.userId} className="flex items-center justify-between text-sm">
                <span>
                  {t.user.firstName} {t.user.lastName}
                </span>
                <form action={removeFormAction}>
                  <input type="hidden" name="subjectId" value={subjectId} />
                  <input type="hidden" name="userId" value={t.userId} />
                  <input type="hidden" name="courseId" value={courseId} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={removePending}
                    className="text-destructive hover:text-destructive h-7 px-2"
                  >
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {available.length > 0 && (
          <form action={assignFormAction} className="space-y-2">
            <input type="hidden" name="subjectId" value={subjectId} />
            <input type="hidden" name="courseId" value={courseId} />
            <Select name="userId" required>
              <SelectTrigger>
                <SelectValue placeholder="Select teacher..." />
              </SelectTrigger>
              <SelectContent>
                {available.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={assignPending}
            >
              {assignPending ? 'Assigning...' : 'Assign Teacher'}
            </Button>
          </form>
        )}

        {available.length === 0 && allTeachers.length > 0 && (
          <p className="text-sm text-muted-foreground">All available teachers are assigned.</p>
        )}

        {allTeachers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No teachers exist. Create a user with the Teacher role first.
          </p>
        )}

        {(assignState.error || removeState.error) && (
          <p className="text-sm text-destructive">{assignState.error ?? removeState.error}</p>
        )}
      </CardContent>
    </Card>
  )
}
