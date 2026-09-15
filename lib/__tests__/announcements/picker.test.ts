import { describe, it, expect } from 'vitest'
import { groupCheckState, toggleGroup, toggleCourse } from '@/lib/announcements/picker'

const levels = ['m1', 'm2', 'm3']

describe('groupCheckState', () => {
  it('reports none, some and all', () => {
    expect(groupCheckState(levels, new Set())).toBe('none')
    expect(groupCheckState(levels, new Set(['m2']))).toBe('some')
    expect(groupCheckState(levels, new Set(levels))).toBe('all')
  })

  it('ignores selections outside the group', () => {
    expect(groupCheckState(levels, new Set(['x']))).toBe('none')
  })
})

describe('toggleGroup', () => {
  it('selects every level when the group is partly selected', () => {
    const next = toggleGroup(levels, new Set(['m1', 'x']))
    expect([...next].sort()).toEqual(['m1', 'm2', 'm3', 'x'])
  })

  it('clears every level when the group is fully selected', () => {
    const next = toggleGroup(levels, new Set([...levels, 'x']))
    expect([...next]).toEqual(['x'])
  })

  it('does not mutate the input', () => {
    const selected = new Set(['m1'])
    toggleGroup(levels, selected)
    expect([...selected]).toEqual(['m1'])
  })
})

describe('toggleCourse', () => {
  it('adds and removes one course', () => {
    expect([...toggleCourse('c1', new Set())]).toEqual(['c1'])
    expect([...toggleCourse('c1', new Set(['c1', 'c2']))]).toEqual(['c2'])
  })
})
