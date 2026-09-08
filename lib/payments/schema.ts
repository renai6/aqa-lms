import { z } from "zod";

export const createPaymentSchema = z.object({
  enrollmentId: z.string().min(1, "Enrollment is required."),
  amount: z.coerce.number().positive("Amount must be greater than 0."),
  // "2026-09". Present only for a course billed monthly; the action decides
  // whether it is required, since only it knows the course.
  periodMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Select which month this payment covers.")
    .nullish(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
