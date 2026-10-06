// A course move soft-removes the source enrollment with this reason, and that
// reason is the only marker that the row was moved rather than dropped: its
// payments now live on the destination enrollment. The remove dialog accepts
// free text, so an admin who types a reason starting with "Moved to " gets a
// row treated as moved too. That is accepted rather than adding a column.
export const MOVED_REASON_PREFIX = "Moved to ";

export function movedReason(courseTitle: string): string {
  return MOVED_REASON_PREFIX + courseTitle;
}

export function isMovedAway(removedReason: string | null): boolean {
  return removedReason?.startsWith(MOVED_REASON_PREFIX) ?? false;
}
