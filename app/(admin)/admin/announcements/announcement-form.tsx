'use client'

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import type { AnnouncementAudience } from '@prisma/client'
import { saveAnnouncementAction, type AnnouncementActionState } from '@/lib/announcements/actions'
import type { AnnouncementCourseOption, AnnouncementForEdit } from '@/lib/announcements/queries'
import { CONTENT_MAX, TITLE_MAX } from '@/lib/announcements/limits'
import { groupCheckState, toggleCourse, toggleGroup, type GroupCheckState } from '@/lib/announcements/picker'
import { groupCourses } from '@/lib/courses/grouping'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  announcement?: AnnouncementForEdit
  courses: AnnouncementCourseOption[]
  initialMessage?: string
}

export function AnnouncementForm({ announcement, courses, initialMessage }: Props) {
  const [state, formAction, isPending] = useActionState<AnnouncementActionState, FormData>(
    saveAnnouncementAction,
    { error: null, message: initialMessage },
  )
  const [audience, setAudience] = useState<AnnouncementAudience>(announcement?.audience ?? 'EVERYONE')
  const [selected, setSelected] = useState<Set<string>>(() => new Set(announcement?.courseIds))
  const [preview, setPreview] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  // Once a save lands, the chosen file is on the server; clear the picker so a
  // second save does not upload it again. Resetting `preview`/`removeImage` is
  // done during render (comparing `state` to the last one we handled) rather
  // than in an effect, since calling setState synchronously inside an effect
  // triggers a cascading extra render. The file input's `.value` is an
  // imperative DOM mutation, not React state, so it still belongs in an effect.
  const [handledState, setHandledState] = useState(state)
  if (state !== handledState && state.message) {
    setHandledState(state)
    setPreview(null)
    setRemoveImage(false)
  }
  useEffect(() => {
    if (state.message && fileRef.current) fileRef.current.value = ''
  }, [state])

  // React resets a <form action> after every submission, which would wipe the
  // admin's text when the server rejects it. Submitting through a transition
  // keeps the fields, and passing the submitter keeps the clicked button's intent.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const formData = new FormData(event.currentTarget, submitter)
    startTransition(() => formAction(formData))
  }

  const isPublished = announcement?.isPublished ?? false
  const currentImage = announcement?.imageUrl && !removeImage ? announcement.imageUrl : null
  const shownImage = preview ?? currentImage

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {announcement && <input type="hidden" name="id" value={announcement.id} />}

          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              required
              maxLength={TITLE_MAX}
              defaultValue={announcement?.title}
              placeholder="e.g. Classes resume after Eid"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">
              Content <span aria-hidden="true">*</span>
            </Label>
            <Textarea
              id="content"
              name="content"
              required
              maxLength={CONTENT_MAX}
              rows={8}
              defaultValue={announcement?.content}
              placeholder="Write the announcement. Line breaks are kept."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Image</Label>
            {shownImage && (
              <img
                src={shownImage}
                alt=""
                className="w-full max-h-72 rounded-md border bg-muted object-contain"
              />
            )}
            <input
              ref={fileRef}
              id="image"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="text-sm w-full"
              onChange={(e) => {
                const chosen = e.target.files?.[0]
                setPreview(chosen ? URL.createObjectURL(chosen) : null)
              }}
            />
            <p className="text-muted-foreground text-xs">
              Optional. JPG, PNG or WEBP, up to 10 MB.
              {announcement?.imageUrl ? ' Choosing a file replaces the current image.' : ''}
            </p>
            {announcement?.imageUrl && !preview && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="removeImage"
                  checked={removeImage}
                  onChange={(e) => setRemoveImage(e.target.checked)}
                  className="accent-primary"
                />
                Remove image
              </label>
            )}
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Audience</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="audience"
                  value="EVERYONE"
                  checked={audience === 'EVERYONE'}
                  onChange={() => setAudience('EVERYONE')}
                  className="accent-primary"
                />
                Everyone
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="audience"
                  value="COURSES"
                  checked={audience === 'COURSES'}
                  onChange={() => setAudience('COURSES')}
                  className="accent-primary"
                />
                Specific courses
              </label>
            </div>
            {audience === 'COURSES' && (
              <CoursePicker courses={courses} selected={selected} onChange={setSelected} />
            )}
          </fieldset>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="isPinned"
              defaultChecked={announcement?.isPinned}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="font-medium">Pin to top</span>
              <span className="block text-xs text-muted-foreground">
                Pinned announcements stay above newer ones.
              </span>
            </span>
          </label>

          {state.error && (
            <p role="alert" className="text-destructive text-sm">{state.error}</p>
          )}
          {state.message && !state.error && (
            <p role="status" className="text-sm text-green-600">{state.message}</p>
          )}

          {/* The first submit button is the one Enter triggers, so it must never publish. */}
          <div className="flex flex-wrap items-center gap-2">
            {isPublished ? (
              <>
                <Button type="submit" name="intent" value="save" disabled={isPending}>
                  Save changes
                </Button>
                <Button type="submit" name="intent" value="unpublish" variant="outline" disabled={isPending}>
                  Unpublish
                </Button>
              </>
            ) : (
              <>
                <Button type="submit" name="intent" value="save" variant="outline" disabled={isPending}>
                  Save draft
                </Button>
                <Button type="submit" name="intent" value="publish" disabled={isPending}>
                  Publish
                </Button>
              </>
            )}
            {isPending && <span className="text-muted-foreground text-sm">Saving...</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

type PickerProps = {
  courses: AnnouncementCourseOption[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

function CoursePicker({ courses, selected, onChange }: PickerProps) {
  if (courses.length === 0) {
    return <p className="text-muted-foreground text-sm">There are no active courses to choose from.</p>
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="max-h-80 space-y-3 overflow-y-auto">
        {groupCourses(courses).map((entry) => {
          if (entry.kind === 'single') {
            return (
              <CourseCheckbox
                key={entry.course.id}
                course={entry.course}
                checked={selected.has(entry.course.id)}
                onToggle={() => onChange(toggleCourse(entry.course.id, selected))}
              />
            )
          }
          const levelIds = entry.levels.map((c) => c.id)
          return (
            <div key={entry.groupName} className="space-y-2">
              <GroupCheckbox
                label={entry.groupName}
                state={groupCheckState(levelIds, selected)}
                onToggle={() => onChange(toggleGroup(levelIds, selected))}
              />
              <div className="ml-6 space-y-2">
                {entry.levels.map((course) => (
                  <CourseCheckbox
                    key={course.id}
                    course={course}
                    checked={selected.has(course.id)}
                    onToggle={() => onChange(toggleCourse(course.id, selected))}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        {selected.size === 1 ? '1 course selected' : `${selected.size} courses selected`}
      </p>
    </div>
  )
}

function CourseCheckbox({
  course,
  checked,
  onToggle,
}: {
  course: AnnouncementCourseOption
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        name="courseIds"
        value={course.id}
        checked={checked}
        onChange={onToggle}
        className="accent-primary"
      />
      <span>{course.title}</span>
      {course.archived && <Badge variant="outline" className="text-xs">Archived</Badge>}
    </label>
  )
}

// Selecting a group is a convenience; only the individual courses are submitted.
function GroupCheckbox({
  label,
  state,
  onToggle,
}: {
  label: string
  state: GroupCheckState
  onToggle: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some'
  }, [state])

  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
      <input
        ref={ref}
        type="checkbox"
        checked={state === 'all'}
        onChange={onToggle}
        className="accent-primary"
      />
      {label} <span className="text-muted-foreground font-normal">(all levels)</span>
    </label>
  )
}
