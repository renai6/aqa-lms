import { describe, it, expect } from 'vitest'
import { contactOf, notificationTarget } from '@/lib/students/contact'

const parent = { firstName: 'Raffi', lastName: 'Muloc', email: 'raffi@example.com', contactNumber: '09171234567' }

describe('contactOf', () => {
  it('returns the student own details when there is no guardian', () => {
    expect(contactOf({ email: 's@example.com', contactNumber: '0918', guardian: null })).toEqual({
      email: 's@example.com',
      contactNumber: '0918',
      parentName: null,
    })
  })

  it('returns the guardian details and name for a kid', () => {
    expect(contactOf({ email: null, contactNumber: null, guardian: parent })).toEqual({
      email: 'raffi@example.com',
      contactNumber: '09171234567',
      parentName: 'Raffi Muloc',
    })
  })

  it('treats a missing guardian field like no guardian', () => {
    expect(contactOf({ email: 's@example.com' })).toEqual({
      email: 's@example.com',
      contactNumber: null,
      parentName: null,
    })
  })
})

describe('notificationTarget', () => {
  it('addresses a student with an email directly', () => {
    expect(notificationTarget({ firstName: 'Sam', email: 's@example.com', guardian: null })).toEqual({
      to: 's@example.com',
      firstName: 'Sam',
      learnerFirstName: null,
    })
  })

  it('addresses a kid through the guardian and names the kid', () => {
    expect(
      notificationTarget({ firstName: 'Ana', email: null, guardian: { firstName: 'Raffi', email: 'raffi@example.com' } }),
    ).toEqual({ to: 'raffi@example.com', firstName: 'Raffi', learnerFirstName: 'Ana' })
  })

  it('returns null when nobody has an address', () => {
    expect(notificationTarget({ firstName: 'Ana', email: null, guardian: null })).toBeNull()
  })
})
