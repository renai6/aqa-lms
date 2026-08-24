import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getEnrollmentForPayment } from "@/lib/payments/queries";
import { canAddPayment } from "@/lib/payments/guards";
import { PaymentForm } from "./payment-form";

export const metadata = { title: "Add Payment — AQA" };

type Props = { params: Promise<{ enrollmentId: string }> };

export default async function AddPaymentPage({ params }: Props) {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") redirect("/login");

  const { enrollmentId } = await params;
  const enrollment = await getEnrollmentForPayment(
    session.userId,
    enrollmentId,
  );

  // Any failing condition sends the student back to where the button was.
  // The action re-checks all of this, so this redirect is convenience only.
  const allowed = canAddPayment(enrollment, enrollment?.payments ?? []);
  if (!allowed.ok || !enrollment) redirect("/student/dashboard");

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Add Payment</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        {enrollment.course.title}
      </p>
      <div className="mt-6">
        <PaymentForm enrollmentId={enrollment.id} />
      </div>
    </div>
  );
}
