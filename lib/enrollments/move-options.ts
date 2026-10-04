import type { PaymentFrequency } from "@prisma/client";

export type CourseMoveTarget = {
  id: string;
  title: string;
  paymentFrequency: PaymentFrequency | null;
  batches: { id: string; label: string }[];
};

export type CourseMoveOption = CourseMoveTarget & {
  disabledReason: string | null;
};

// The courses an admin may pick when moving one enrollment. Courses the move
// action would refuse stay listed but disabled, so the admin sees why instead
// of wondering where a course went. The action re-checks every rule.
export function courseMoveOptions(
  targets: CourseMoveTarget[],
  current: {
    courseId: string;
    paymentFrequency: PaymentFrequency | null;
    activeCourseIds: string[];
  },
): CourseMoveOption[] {
  return targets
    .filter(
      (t) =>
        t.id !== current.courseId && !current.activeCourseIds.includes(t.id),
    )
    .map((t) => ({
      ...t,
      disabledReason:
        t.paymentFrequency !== current.paymentFrequency
          ? "Billed differently"
          : t.batches.length === 0
            ? "No batches"
            : null,
    }));
}
