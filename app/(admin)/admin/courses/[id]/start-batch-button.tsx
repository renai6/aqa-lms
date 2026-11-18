'use client'

import { useActionState, useState } from 'react'
import { startNewBatchAction } from '@/lib/batches/actions'
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
  courseId: string
  // What the batch is called when the name field is left empty.
  defaultName: string
}

export function StartBatchButton({ courseId, defaultName }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Start New Batch
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {/* The dialog content unmounts on close, so every open starts with an
            empty name and no stale error. */}
        <StartBatchForm courseId={courseId} defaultName={defaultName} onDone={() => setOpen(false)} />
      </AlertDialogContent>
    </AlertDialog>
  )
}

function StartBatchForm({ courseId, defaultName, onDone }: Props & { onDone: () => void }) {
  // Controlled, because React resets uncontrolled fields after every action
  // and a failed start would otherwise wipe the typed name.
  const [name, setName] = useState('')
  const [state, action, isPending] = useActionState(
    async (prev: { error: string | null }, formData: FormData) => {
      const result = await startNewBatchAction(prev, formData)
      if (result.success) onDone()
      return result
    },
    { error: null },
  )

  return (
    <form action={action}>
      <input type="hidden" name="courseId" value={courseId} />
      <AlertDialogHeader>
        <AlertDialogTitle>Start a new batch</AlertDialogTitle>
        <AlertDialogDescription>
          New enrollments will be assigned to it. Existing students stay in their current batch.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="space-y-2 py-4">
        <Label htmlFor="batch-name">Batch name</Label>
        <Input
          id="batch-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={defaultName}
          maxLength={60}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">Leave empty to use {defaultName}.</p>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Starting...' : 'Start'}
        </Button>
      </AlertDialogFooter>
    </form>
  )
}
