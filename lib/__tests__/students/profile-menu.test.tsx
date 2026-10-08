// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/lib/students/dependent-actions', () => ({ switchProfileAction: vi.fn() }))

import { switchProfileAction } from '@/lib/students/dependent-actions'
import { ProfileMenu } from '@/components/student/profile-menu'

afterEach(cleanup)

function renderMenu() {
  render(
    <ProfileMenu self={{ firstName: 'Raffi' }} kids={[{ id: 'k1', firstName: 'Ana' }]} activeKidId="k1" canManageKids />,
  )
  const trigger = screen.getByRole('button', { name: 'Ana' })
  fireEvent.click(trigger)
  return trigger
}

describe('ProfileMenu', () => {
  it('is a disclosure that marks the current profile', () => {
    const trigger = renderMenu()

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(trigger.getAttribute('aria-controls')!)).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ana\s*Current/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Raffi (me)' })).not.toHaveAttribute('aria-current')
  })

  it('closes on Escape and returns focus to the trigger', () => {
    const trigger = renderMenu()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Studying as')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('shows the switch as pending, then closes once it settles', async () => {
    let settle!: () => void
    vi.mocked(switchProfileAction).mockImplementation(() => new Promise<void>((r) => (settle = r)))
    renderMenu()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Raffi (me)' })))

    const pending = screen.getByRole('button', { name: /Raffi \(me\)\s*Switching/ })
    expect(pending).toBeDisabled()
    expect(switchProfileAction).toHaveBeenCalledTimes(1)

    await act(async () => settle())

    expect(screen.queryByText('Studying as')).not.toBeInTheDocument()
  })
})
