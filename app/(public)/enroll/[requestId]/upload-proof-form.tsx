'use client'

import { useActionState } from 'react'
import { uploadProofAction } from '@/lib/enrollments/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = { requestId: string }

export function UploadProofForm({ requestId }: Props) {
  const [state, formAction, isPending] = useActionState(uploadProofAction, { error: null })

  if (state.success) {
    return (
      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
        Thank you — your proof of payment has been received. We will notify you by email once reviewed.
      </p>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="space-y-2">
        <Label htmlFor="file">Select image file</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
        <p className="text-xs text-muted-foreground">Accepted: JPG, PNG, WEBP. Max 5MB.</p>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Uploading...' : 'Upload Proof of Payment'}
      </Button>
    </form>
  )
}
