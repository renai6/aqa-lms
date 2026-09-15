// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { AnnouncementImage } from '@/components/student/announcement-image'

const SRC = 'https://example.supabase.co/storage/v1/object/public/course-images/announcements/a.png'

function renderImage() {
  render(<AnnouncementImage src={SRC} title="Classes resume after Eid" variant="full" />)
  return screen.getByRole('button', { name: 'Enlarge image: Classes resume after Eid' })
}

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('AnnouncementImage', () => {
  it('is closed until the image is clicked', () => {
    renderImage()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens a dialog showing the image and focuses its close button', () => {
    fireEvent.click(renderImage())

    const dialog = screen.getByRole('dialog', { name: 'Classes resume after Eid' })
    expect(within(dialog).getByRole('img', { name: 'Classes resume after Eid' })).toBeTruthy()
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close' }))
  })

  it('stops the page behind from scrolling while open, and restores it on close', () => {
    document.body.style.overflow = 'auto'
    fireEvent.click(renderImage())
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.body.style.overflow).toBe('auto')
  })

  it.each([
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
    ['the close button', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
    ['a backdrop click', () => fireEvent.click(screen.getByRole('dialog'))],
  ])('closes on %s and returns focus to the image', (_, close) => {
    const trigger = renderImage()
    fireEvent.click(trigger)

    close()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('stays open when the enlarged image itself is clicked', () => {
    fireEvent.click(renderImage())
    const dialog = screen.getByRole('dialog')

    fireEvent.click(within(dialog).getByRole('img'))

    expect(screen.queryByRole('dialog')).not.toBeNull()
  })

  it('ignores other keys while open', () => {
    fireEvent.click(renderImage())
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.queryByRole('dialog')).not.toBeNull()
  })
})
