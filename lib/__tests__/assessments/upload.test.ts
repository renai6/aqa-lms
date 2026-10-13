import { describe, it, expect } from 'vitest'
import { parseUploadFolder, uploadAnswerError } from '@/lib/assessments/upload'

const FOLDER = 'https://drive.google.com/drive/folders/1FoLd-eR_9?usp=sharing'
const FILE = 'https://drive.google.com/file/d/1AbC-dEf_23/view?usp=drive_link'

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('parseUploadFolder', () => {
  it('stores no folder for a question that is not a file upload', () => {
    expect(parseUploadFolder('ESSAY', form({ uploadFolderUrl: FOLDER }))).toEqual({
      uploadFolderUrl: null,
    })
  })

  it('stores the canonical folder url for a file upload', () => {
    expect(
      parseUploadFolder(
        'FILE_UPLOAD',
        form({ uploadFolderUrl: 'https://drive.google.com/drive/u/1/folders/1FoLd-eR_9?usp=sharing' }),
      ),
    ).toEqual({ uploadFolderUrl: 'https://drive.google.com/drive/folders/1FoLd-eR_9' })
  })

  it('rejects a file upload with no folder link', () => {
    expect(parseUploadFolder('FILE_UPLOAD', form({}))).toMatch(/Google Drive folder/)
  })

  it('rejects a file upload whose link is a file, not a folder', () => {
    expect(
      parseUploadFolder('FILE_UPLOAD', form({ uploadFolderUrl: FILE })),
    ).toMatch(/Google Drive folder/)
  })
})

describe('uploadAnswerError', () => {
  const questions = [
    { id: 'q1', type: 'MULTIPLE_CHOICE' as const },
    { id: 'q2', type: 'FILE_UPLOAD' as const },
  ]

  it('accepts a Google Drive file link', () => {
    expect(
      uploadAnswerError(questions, [
        { questionId: 'q1', answer: 'Paris' },
        { questionId: 'q2', answer: FILE },
      ]),
    ).toBeNull()
  })

  it('accepts a blank upload answer, which counts as unanswered', () => {
    expect(
      uploadAnswerError(questions, [
        { questionId: 'q1', answer: '' },
        { questionId: 'q2', answer: '' },
      ]),
    ).toBeNull()
  })

  it('names the question whose link is not a Drive file link', () => {
    expect(
      uploadAnswerError(questions, [
        { questionId: 'q1', answer: 'Paris' },
        { questionId: 'q2', answer: 'my video.mp4' },
      ]),
    ).toMatch(/^Question 2: /)
  })

  it('rejects the folder link itself, which does not identify the student file', () => {
    expect(
      uploadAnswerError(questions, [{ questionId: 'q2', answer: FOLDER }]),
    ).toMatch(/^Question 2: /)
  })

  it('ignores free text on a question that is not a file upload', () => {
    expect(
      uploadAnswerError(
        [{ id: 'q1', type: 'ESSAY' as const }],
        [{ questionId: 'q1', answer: 'not a link at all' }],
      ),
    ).toBeNull()
  })
})
