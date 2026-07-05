// Gender-based subject visibility. Kept pure (type-only Prisma import) so it can
// be unit-tested without pulling in the database client.
import type { Gender } from "@prisma/client";

// Can a user of `userGender` see a subject restricted to `subjectGender`?
// A null subject gender means "everyone"; a null user gender (legacy rows) is
// fail-closed and only sees unrestricted subjects.
export function canSeeSubject(
  userGender: Gender | null,
  subjectGender: Gender | null,
): boolean {
  if (subjectGender == null) return true;
  return userGender === subjectGender;
}

// Prisma `where` fragment for the `Subject.gender` column that keeps only the
// subjects a viewer of `userGender` may see. Spread into a subject-level filter.
export function subjectGenderFilter(
  userGender: Gender | null,
): { gender: null } | { OR: [{ gender: null }, { gender: Gender }] } {
  if (userGender == null) return { gender: null };
  return { OR: [{ gender: null }, { gender: userGender }] };
}

// Prisma `where` fragment on an Enrollment that keeps only enrollees who may
// participate in a subject of `subjectGender`. For a mixed subject (null) this
// is empty (everyone); for a restricted subject it requires a matching gender,
// which also excludes null-gender enrollees (fail-closed, D3/D5).
export function enrolleeGenderWhere(
  subjectGender: Gender | null,
): Record<string, never> | { user: { gender: Gender } } {
  if (subjectGender == null) return {};
  return { user: { gender: subjectGender } };
}
