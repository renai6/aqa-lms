// Archived courses are hidden from every catalog, admin, and student surface.
// This filter lives in one place so the rule stays greppable and there is a
// single spot to audit when a new course query is added.
export const ACTIVE_COURSE = { archivedAt: null } as const;
