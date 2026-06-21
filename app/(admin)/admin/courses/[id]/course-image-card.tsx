'use client'

import { useActionState } from 'react'
import { uploadCourseImageAction, removeCourseImageAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ActionState = { error: string | null; success?: boolean }

type Props = { courseId: string; imageUrl: string | null }

export function CourseImageCard({ courseId, imageUrl }: Props) {
  const [uploadState, uploadAction, isUploading] = useActionState<ActionState, FormData>(
    uploadCourseImageAction,
    { error: null },
  )
  const [removeState, removeAction, isRemoving] = useActionState<ActionState, FormData>(
    removeCourseImageAction,
    { error: null },
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Image</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {imageUrl && (
          <div className="space-y-2">
            <img
              src={imageUrl}
              alt="Course image"
              className="w-full rounded-md object-cover aspect-video"
            />
            <form action={removeAction}>
              <input type="hidden" name="courseId" value={courseId} />
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={isRemoving}
                className="w-full"
              >
                {isRemoving ? 'Removing...' : 'Remove Image'}
              </Button>
            </form>
            {removeState.error && (
              <p className="text-sm text-destructive">{removeState.error}</p>
            )}
          </div>
        )}
        <form action={uploadAction} className="space-y-3">
          <input type="hidden" name="courseId" value={courseId} />
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm w-full"
            required
          />
          <Button type="submit" disabled={isUploading} className="w-full">
            {isUploading ? 'Uploading...' : imageUrl ? 'Replace Image' : 'Upload Image'}
          </Button>
        </form>
        {uploadState.error && (
          <p className="text-sm text-destructive">{uploadState.error}</p>
        )}
        {uploadState.success && !uploadState.error && (
          <p className="text-sm text-green-600">Image saved.</p>
        )}
      </CardContent>
    </Card>
  )
}
