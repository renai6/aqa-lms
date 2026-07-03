'use client'

import { useActionState } from 'react'
import { publishAssessmentAction, unpublishAssessmentAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {
  assessmentId: string
  subjectId: string
  courseId: string
  isPublished: boolean
  blockers: string[]
}

export function PublishPanel({ assessmentId, subjectId, courseId, isPublished, blockers }: Props) {
  const [publishState, publishAction, publishPending] = useActionState(publishAssessmentAction, { error: null })
  const [unpublishState, unpublishAction, unpublishPending] = useActionState(unpublishAssessmentAction, { error: null })

  return (
    <Card>
      <CardHeader><CardTitle>Visibility</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {isPublished ? (
          <>
            <p className="text-sm text-green-600 font-medium">Published - visible to students</p>
            <p className="text-xs text-muted-foreground">
              Unpublishing will hide this assessment from students but will not delete any existing attempts.
            </p>
            <form action={unpublishAction}>
              <input type="hidden" name="id" value={assessmentId} />
              <input type="hidden" name="subjectId" value={subjectId} />
              <input type="hidden" name="courseId" value={courseId} />
              <Button type="submit" variant="outline" size="sm" disabled={unpublishPending} className="w-full">
                {unpublishPending ? 'Unpublishing...' : 'Unpublish'}
              </Button>
            </form>
            {unpublishState.error && <p className="text-sm text-destructive">{unpublishState.error}</p>}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Draft - not visible to students</p>
            {blockers.length > 0 && (
              <ul className="space-y-1">
                {blockers.map((b, i) => (
                  <li key={i} className="text-xs text-destructive">- {b}</li>
                ))}
              </ul>
            )}
            <form action={publishAction}>
              <input type="hidden" name="id" value={assessmentId} />
              <input type="hidden" name="subjectId" value={subjectId} />
              <input type="hidden" name="courseId" value={courseId} />
              <Button
                type="submit"
                size="sm"
                disabled={publishPending || blockers.length > 0}
                className="w-full"
              >
                {publishPending ? 'Publishing...' : 'Publish'}
              </Button>
            </form>
            {publishState.error && <p className="text-sm text-destructive">{publishState.error}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}
