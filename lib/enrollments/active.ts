// A removed enrollment is one an admin took the student out of. The row is
// never destroyed, so every student-facing read has to exclude it explicitly.
// This filter lives in one place so the rule stays greppable and there is a
// single spot to audit when a new enrollment query is added.
//
// Staff surfaces deliberately do NOT apply it: admins still see removed rows
// (badged as such, with a restore action) so the history stays auditable.
export const ACTIVE_ENROLLMENT = { removedAt: null } as const;
