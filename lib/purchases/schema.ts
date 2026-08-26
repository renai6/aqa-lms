import { z } from "zod";

const PH_MOBILE = /^(09\d{9}|\+639\d{9})$/;

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required."),
    lastName: z.string().trim().min(1, "Last name is required."),
    email: z.string().email("A valid email address is required."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Za-z]/, "Password must contain a letter.")
      .regex(/\d/, "Password must contain a number."),
    confirmPassword: z.string(),
    gender: z.enum(["MALE", "FEMALE"], { error: "Gender is required." }),
    address: z.string().trim().min(1, "Address is required."),
    contactNumber: z
      .string()
      .trim()
      .regex(PH_MOBILE, "Enter a valid PH mobile number (e.g. 09XXXXXXXXX)."),
    facebookName: z.string().trim().min(1, "Facebook name is required."),
    facebookLink: z
      .string()
      .url("Enter a valid URL.")
      .refine((u) => u.startsWith("https://"), "Link must use HTTPS."),
    studentType: z.enum(["NEW", "OLD"], { error: "Student type is required." }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const createPurchaseSchema = z
  .object({
    courseIds: z.array(z.string().min(1)).min(1, "Select at least one course."),
    paymentType: z.enum(["PARTIAL", "FULL"], {
      error: "Payment type is required.",
    }),
    // Zero is legal at this level so a pay-later purchase can omit the field
    // entirely. The refinement below is what makes zero illegal when the
    // student is paying now.
    amountPaid: z.coerce
      .number()
      .nonnegative("Amount paid cannot be negative.")
      .multipleOf(0.01, "Amount paid must be a whole number of centavos."),
    payLater: z.boolean(),
    studentType: z.enum(["NEW", "OLD"]),
  })
  .superRefine((d, ctx) => {
    if (d.payLater && d.amountPaid !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amountPaid"],
        message: "A pay-later purchase cannot include an amount.",
      });
    }
    if (!d.payLater && d.amountPaid <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amountPaid"],
        message: "Amount paid must be greater than 0.",
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
