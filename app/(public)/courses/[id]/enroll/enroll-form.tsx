'use client'

import { useActionState } from 'react'
import { submitEnrollmentAction } from '@/lib/enrollments/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = { courseId: string; courseTitle: string }

export function EnrollForm({ courseId, courseTitle }: Props) {
  const [state, formAction, isPending] = useActionState(submitEnrollmentAction, { error: null })

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="p-3 bg-muted rounded-md text-sm">
        <span className="text-muted-foreground">Enrolling in: </span>
        <strong>{courseTitle}</strong>
      </div>
      <div className="space-y-2">
        <Label htmlFor="firstName">First Name</Label>
        <Input id="firstName" name="firstName" required placeholder="Juan" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lastName">Last Name</Label>
        <Input id="lastName" name="lastName" required placeholder="dela Cruz" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input id="email" name="email" type="email" required placeholder="juan@example.com" />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Submitting...' : 'Submit Application'}
      </Button>
    </form>
  )
}
