import { z } from "zod";

export const createPaymentSchema = z.object({
  enrollmentId: z.string().min(1, "Enrollment is required."),
  amount: z.coerce.number().positive("Amount must be greater than 0."),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
