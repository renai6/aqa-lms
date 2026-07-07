// Groups courses that share a `groupName` into a single listing entry.
// Courses without a group name stay standalone. The rule lives here so every
// surface (public listing, student cart, group page) collapses identically.

export type GroupableCourse = {
  id: string;
  title: string;
  groupName: string | null;
  level: number | null;
};

export type GroupedCourse<T extends GroupableCourse> =
  | { kind: "single"; course: T }
  | { kind: "group"; groupName: string; slug: string; levels: T[] };

// URL-safe identifier for a group name; used for /courses/group/[slug].
export function slugifyGroup(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Sorts a group's courses by level ascending (nulls last), then title.
function byLevelThenTitle<T extends GroupableCourse>(a: T, b: T): number {
  if (a.level != null && b.level != null && a.level !== b.level)
    return a.level - b.level;
  if (a.level == null && b.level != null) return 1;
  if (a.level != null && b.level == null) return -1;
  return a.title.localeCompare(b.title);
}

// Returns entries in first-appearance order. A group is emitted at the position
// of its first member; its `levels` are sorted by level then title.
export function groupCourses<T extends GroupableCourse>(
  courses: T[],
): GroupedCourse<T>[] {
  const groups = new Map<string, T[]>();
  const result: GroupedCourse<T>[] = [];

  for (const course of courses) {
    const name = course.groupName?.trim();
    if (!name) {
      result.push({ kind: "single", course });
      continue;
    }
    const existing = groups.get(name);
    if (existing) {
      existing.push(course);
    } else {
      const levels: T[] = [course];
      groups.set(name, levels);
      result.push({
        kind: "group",
        groupName: name,
        slug: slugifyGroup(name),
        levels,
      });
    }
  }

  for (const entry of result) {
    if (entry.kind === "group") entry.levels.sort(byLevelThenTitle);
  }

  return result;
}
