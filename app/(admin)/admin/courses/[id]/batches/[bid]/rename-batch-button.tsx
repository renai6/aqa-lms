'use client'

import { useActionState, useState } from 'react'
import { renameBatchAction } from '@/lib/batches/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

type Props = {
  batchId: string
  courseId: string
  currentName: string
}

export function RenameBatchButton({ batchId, courseId, currentName }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Rename
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {/* The dialog content unmounts on close, so every open starts from the
            saved name with no stale error. */}
        <RenameBatchForm
          batchId={batchId}
          courseId={courseId}
          currentName={currentName}
          onDone={() => setOpen(false)}
        />
      </AlertDialogContent>
    </AlertDialog>
  )
}

function RenameBatchForm({ batchId, courseId, currentName, onDone }: Props & { onDone: () => void }) {
  // Controlled, because React resets uncontrolled fields after every action
  // and a failed save would otherwise throw away the edit.
  const [name, setName] = useState(currentName)
  const [state, action, isPending] = useActionState(
    async (prev: { error: string | null }, formData: FormData) => {
      const result = await renameBatchAction(prev, formData)
      if (result.success) onDone()
      return result
    },
    { error: null },
  )

  return (
    <form action={action}>
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="courseId" value={courseId} />
      <AlertDialogHeader>
        <AlertDialogTitle>Rename batch</AlertDialogTitle>
        <AlertDialogDescription>
          The new name shows everywhere this batch is listed, for admins, teachers and students.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="space-y-2 py-4">
        <Label htmlFor="rename-batch-name">Batch name</Label>
        <Input
          id="rename-batch-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
          autoComplete="off"
        />
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </AlertDialogFooter>
    </form>
  )
}
