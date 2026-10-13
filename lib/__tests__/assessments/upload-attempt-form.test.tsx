// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions', () => ({
  submitAttemptAction: vi.fn(),
}))

import { submitAttemptAction } from '@/app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions'
import { AttemptForm } from '@/app/(student)/student/courses/[id]/subjects/[sid]/assessments/[aid]/attempt/[attemptId]/attempt-form'

const FOLDER = 'https://drive.google.com/drive/folders/1FoLd-eR_9'

const questions = [
  {
    id: 'q1',
    questionText: 'Capital of France?',
    type: 'MULTIPLE_CHOICE' as const,
    points: 1,
    order: 1,
    mediaType: null,
    mediaUrl: null,
    uploadFolderUrl: null,
    options: [
      { id: 'o1', label: 'Paris', value: 'Paris' },
      { id: 'o2', label: 'Rome', value: 'Rome' },
    ],
  },
  {
    id: 'q2',
    questionText: 'Record yourself reading the passage.',
    type: 'FILE_UPLOAD' as const,
    points: 5,
    order: 2,
    mediaType: null,
    mediaUrl: null,
    uploadFolderUrl: FOLDER,
    options: [],
  },
]

function renderForm() {
  return render(
    <AttemptForm attemptId="att1" assessmentTitle="Exam 1" questions={questions} deadline={null} />,
  )
}

describe('AttemptForm with a file upload question', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opens the upload folder in a new tab', () => {
    renderForm()
    const link = screen.getByRole('link', { name: /open upload folder/i })
    expect(link).toHaveAttribute('href', FOLDER)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('warns as soon as the pasted link is not a Drive file', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/link to your uploaded file/i), {
      target: { value: 'my-video.mp4' },
    })
    expect(screen.getByText('That is not a Google Drive file link.')).toBeInTheDocument()
  })

  it('keeps every answer when the server refuses the submit', async () => {
    vi.mocked(submitAttemptAction).mockResolvedValue({
      error: 'Question 2: that is not a Google Drive file link.',
    })
    renderForm()

    fireEvent.click(screen.getByLabelText('Paris'))
    fireEvent.change(screen.getByLabelText(/link to your uploaded file/i), {
      target: { value: 'my-video.mp4' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit assessment/i }))

    await screen.findByText('Question 2: that is not a Google Drive file link.')
    const sent = vi.mocked(submitAttemptAction).mock.calls[0][1] as FormData
    expect(sent.get('answer_q1')).toBe('Paris')
    expect(sent.get('answer_q2')).toBe('my-video.mp4')
    await waitFor(() => expect(screen.getByLabelText('Paris')).toBeChecked())
    expect(screen.getByLabelText(/link to your uploaded file/i)).toHaveValue('my-video.mp4')
  })
})
