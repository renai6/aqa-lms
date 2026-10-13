// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SubmittedFile } from '@/components/assessments/submitted-file'

const FILE = 'https://drive.google.com/file/d/1AbC-dEf_23/view?usp=drive_link'

describe('SubmittedFile', () => {
  it('links to the Drive file in a new tab', () => {
    render(<SubmittedFile url={FILE} />)
    const link = screen.getByRole('link', { name: /open submitted file/i })
    expect(link).toHaveAttribute('href', FILE)
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('says nothing was submitted for a blank answer', () => {
    render(<SubmittedFile url="" />)
    expect(screen.getByText('No file submitted.')).toBeInTheDocument()
  })

  it('never turns a non-Drive answer into a link', () => {
    render(<SubmittedFile url="javascript:alert(1)" />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
