import { z } from 'zod'
import { CONTENT_MAX, TITLE_MAX } from './limits'

const announcementSchema = z
  .object({
    id: z.string().min(1).optional(),
    title: z
      .string()
      .trim()
      .min(1, 'Title is required.')
      .max(TITLE_MAX, 'Title must be 200 characters or fewer.'),
    content: z
      .string()
      .trim()
      .min(1, 'Content is required.')
      .max(CONTENT_MAX, 'Content must be 5,000 characters or fewer.'),
    audience: z.enum(['EVERYONE', 'COURSES'], { error: 'Please choose an audience.' }),
    courseIds: z.array(z.string().min(1)).transform((ids) => [...new Set(ids)]),
    isPinned: z.boolean(),
    removeImage: z.boolean(),
    intent: z.enum(['save', 'publish', 'unpublish'], { error: 'Invalid action.' }),
  })
  .refine((d) => d.audience === 'EVERYONE' || d.courseIds.length > 0, {
    message: 'Choose at least one course.',
    path: ['courseIds'],
  })

export type AnnouncementInput = z.output<typeof announcementSchema>

// A textarea's maxLength counts a line break as one character, but form
// submission sends CRLF, which would count as two against the same limit.
// Normalizing before validation keeps the browser and server limits in sync,
// and the stored text always uses a plain \n.
function normalizeLineBreaks(value: FormDataEntryValue | null): FormDataEntryValue {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n') : (value ?? '')
}

export function parseAnnouncementForm(
  formData: FormData,
): { ok: true; data: AnnouncementInput } | { ok: false; error: string } {
  const id = formData.get('id')
  const result = announcementSchema.safeParse({
    id: typeof id === 'string' && id !== '' ? id : undefined,
    title: normalizeLineBreaks(formData.get('title')),
    content: normalizeLineBreaks(formData.get('content')),
    audience: formData.get('audience'),
    courseIds: formData.getAll('courseIds').filter((v): v is string => typeof v === 'string'),
    isPinned: formData.get('isPinned') === 'on',
    removeImage: formData.get('removeImage') === 'on',
    intent: formData.get('intent'),
  })
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }
  return { ok: true, data: result.data }
}
