'use client'

import { useActionState, useState } from 'react'
import { copySubjectToCourseAction } from '../../actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { CourseOption } from '@/lib/courses/queries'

type Props = {
  subjectId: string
  subjectTitle: string
  courses: CourseOption[]
}

export function CopySubjectDialog({ subjectId, subjectTitle, courses }: Props) {
  const [state, formAction, isPending] = useActionState(copySubjectToCourseAction, { error: null })
  const [targetCourseId, setTargetCourseId] = useState('')
  const noTargets = courses.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Copy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full" disabled={noTargets}>
              Copy to course
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <form action={formAction}>
              <input type="hidden" name="subjectId" value={subjectId} />
              <input type="hidden" name="targetCourseId" value={targetCourseId} />
              <AlertDialogHeader>
                <AlertDialogTitle>Copy &quot;{subjectTitle}&quot; to another course</AlertDialogTitle>
                <AlertDialogDescription>
                  This copies the subject with its lessons and schedule into the selected course.
                  Assessments and student data are not copied.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-1 py-4">
                <Label>Target course</Label>
                <Select value={targetCourseId} onValueChange={setTargetCourseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course..." />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {state.error && <p className="text-sm text-destructive">{state.error}</p>}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                <Button type="submit" disabled={isPending || !targetCourseId}>
                  {isPending ? 'Copying...' : 'Copy'}
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>

        {noTargets && (
          <p className="text-sm text-muted-foreground">No other courses to copy into.</p>
        )}
      </CardContent>
    </Card>
  )
}
