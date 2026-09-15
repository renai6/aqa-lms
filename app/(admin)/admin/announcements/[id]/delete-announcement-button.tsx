'use client'

import { useActionState } from 'react'
import { deleteAnnouncementAction } from '@/lib/announcements/actions'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = { id: string; title: string }

export function DeleteAnnouncementButton({ id, title }: Props) {
  const [state, formAction, isPending] = useActionState(deleteAnnouncementAction, { error: null })
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive text-sm">Danger Zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" disabled={isPending}>
              {isPending ? 'Deleting...' : 'Delete Announcement'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &quot;{title}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                Students will no longer see it, and its image is deleted too. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <form action={formAction}>
                <input type="hidden" name="id" value={id} />
                <AlertDialogAction
                  type="submit"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </CardContent>
    </Card>
  )
}
