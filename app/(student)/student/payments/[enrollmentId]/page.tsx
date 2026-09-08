import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getEnrollmentForPayment } from "@/lib/payments/queries";
import { canAddPayment } from "@/lib/payments/guards";
import { describeBalance, peso } from "@/lib/payments/balance";
import { selectableMonths } from "@/lib/payments/monthly";
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

  const months =
    enrollment.course.paymentFrequency === "MONTHLY"
      ? selectableMonths(enrollment, enrollment.payments, new Date())
      : [];

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Add Payment</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        {enrollment.course.title}
      </p>
      {enrollment.balance.kind === "tracked" && (
        <p className="mt-2 text-sm font-medium text-amber-600">
          {describeBalance(enrollment.balance)}
        </p>
      )}
      {months.length > 0 && (
        <div className="mt-4 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">Your monthly payments</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {months.map((m) => (
              <li key={m.key} className="flex justify-between gap-4">
                <span>{m.label}</span>
                <span
                  className={
                    m.status.kind === "partial" ? "text-amber-600" : "text-muted-foreground"
                  }
                >
                  {m.status.kind === "partial"
                    ? `${peso(m.status.short)} remaining`
                    : m.status.kind === "unscored"
                      ? "—"
                      : "Not yet paid"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-6">
        <PaymentForm enrollmentId={enrollment.id} months={months} />
      </div>
    </div>
  );
}
