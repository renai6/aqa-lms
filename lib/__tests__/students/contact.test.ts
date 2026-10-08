import { describe, it, expect } from 'vitest'
import { contactOf, notificationTargets } from '@/lib/students/contact'

const parent = { firstName: 'Raffi', lastName: 'Muloc', email: 'raffi@example.com', contactNumber: '09171234567' }

describe('contactOf', () => {
  it('returns the student own details when there is no guardian', () => {
    expect(contactOf({ email: 's@example.com', contactNumber: '0918', guardian: null })).toEqual({
      email: 's@example.com',
      contactNumber: '0918',
      parentName: null,
      viaParent: false,
    })
  })

  it('returns the guardian details and name for a kid', () => {
    expect(contactOf({ email: null, contactNumber: null, guardian: parent })).toEqual({
      email: 'raffi@example.com',
      contactNumber: '09171234567',
      parentName: 'Raffi Muloc',
      viaParent: true,
    })
  })

  it('contacts a linked kid with their own email directly but keeps the parent name', () => {
    expect(contactOf({ email: 'kid@example.com', contactNumber: '0918', guardian: parent })).toEqual({
      email: 'kid@example.com',
      contactNumber: '0918',
      parentName: 'Raffi Muloc',
      viaParent: false,
    })
  })

  it('treats a missing guardian field like no guardian', () => {
    expect(contactOf({ email: 's@example.com' })).toEqual({
      email: 's@example.com',
      contactNumber: null,
      parentName: null,
      viaParent: false,
    })
  })
})

describe('notificationTargets', () => {
  it('addresses a student with an email directly', () => {
    expect(notificationTargets({ firstName: 'Sam', email: 's@example.com', guardian: null })).toEqual([
      { to: 's@example.com', firstName: 'Sam', learnerFirstName: null },
    ])
  })

  it('addresses a kid without an email through the guardian and names the kid', () => {
    expect(
      notificationTargets({ firstName: 'Ana', email: null, guardian: { firstName: 'Raffi', email: 'raffi@example.com' } }),
    ).toEqual([{ to: 'raffi@example.com', firstName: 'Raffi', learnerFirstName: 'Ana' }])
  })

  it('addresses a linked kid and the guardian, kid first', () => {
    expect(
      notificationTargets({
        firstName: 'Ana',
        email: 'ana@example.com',
        guardian: { firstName: 'Raffi', email: 'raffi@example.com' },
      }),
    ).toEqual([
      { to: 'ana@example.com', firstName: 'Ana', learnerFirstName: null },
      { to: 'raffi@example.com', firstName: 'Raffi', learnerFirstName: 'Ana' },
    ])
  })

  it('returns nothing when nobody has an address', () => {
    expect(notificationTargets({ firstName: 'Ana', email: null, guardian: null })).toEqual([])
  })
})
