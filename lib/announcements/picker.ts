// Selection rules for the audience picker's group checkboxes, kept pure so
// they can be tested without rendering the form.

export type GroupCheckState = 'all' | 'some' | 'none'

export function groupCheckState(
  levelIds: readonly string[],
  selected: ReadonlySet<string>,
): GroupCheckState {
  const count = levelIds.filter((id) => selected.has(id)).length
  if (count === 0) return 'none'
  return count === levelIds.length ? 'all' : 'some'
}

// A fully selected group clears; anything less selects every level.
export function toggleGroup(levelIds: readonly string[], selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected)
  const clear = groupCheckState(levelIds, selected) === 'all'
  for (const id of levelIds) {
    if (clear) next.delete(id)
    else next.add(id)
  }
  return next
}

export function toggleCourse(id: string, selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}
