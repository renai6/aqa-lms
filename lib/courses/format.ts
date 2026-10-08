import type { CourseStatus, PaymentFrequency } from "@prisma/client";

const FREQUENCY_SUFFIX: Record<PaymentFrequency, string> = {
  MONTHLY: "/ month",
  YEARLY: "/ year",
  ONE_TIME: "one-time",
};

export function priceSuffix(freq: PaymentFrequency | null): string {
  return freq ? FREQUENCY_SUFFIX[freq] : "";
}

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  ENROLLMENT_ONGOING: "Enrollment Ongoing",
  CLASSES_ONGOING: "Classes Ongoing",
  SEMESTER_ENDED: "Semester Ended",
};
