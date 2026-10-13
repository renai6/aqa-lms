import type { QuestionType } from '@prisma/client'
import { extractDriveFileId } from '@/lib/assessments/media'
import { driveFolderUrl, parseDriveFolderId } from '@/lib/batches/drive'

// A FILE_UPLOAD question sends the student to a Google Drive folder to upload
// their work, and their answer is the link to the file they put there. The app
// never touches Drive itself; it only checks the shape of both links.

/**
 * Reads the upload folder off a question form. Only a FILE_UPLOAD question
 * keeps one, so switching a question to another type clears it.
 */
export function parseUploadFolder(
  type: string,
  formData: FormData,
): { uploadFolderUrl: string | null } | string {
  if (type !== 'FILE_UPLOAD') return { uploadFolderUrl: null }

  const raw = formData.get('uploadFolderUrl')
  const folderId = typeof raw === 'string' ? parseDriveFolderId(raw) : null
  if (!folderId) return 'Enter a valid Google Drive folder link for students to upload to.'

  // Stored account-neutral: an admin's /u/1/ link would open the wrong Google
  // account, or none, for a student.
  return { uploadFolderUrl: driveFolderUrl(folderId) }
}

/**
 * Returns an error naming the first file-upload answer that is not a Drive file
 * link, or null. A blank answer is allowed and counts as unanswered. Questions
 * must be in display order so the number matches what the student sees.
 */
export function uploadAnswerError(
  questions: { id: string; type: QuestionType }[],
  submitted: { questionId: string; answer: string }[],
): string | null {
  const answers = new Map(submitted.map((s) => [s.questionId, s.answer]))

  for (const [i, q] of questions.entries()) {
    if (q.type !== 'FILE_UPLOAD') continue
    const answer = answers.get(q.id) ?? ''
    if (answer !== '' && !extractDriveFileId(answer)) {
      return (
        'Question ' + (i + 1) +
        ': that is not a Google Drive file link. Paste the link to the file you uploaded, or leave it blank.'
      )
    }
  }
  return null
}
