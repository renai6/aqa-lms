import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { ProofImage } from "@/components/admin/proof-image";
import { BalanceSummary } from "@/components/admin/balance-summary";
import { getAdminPaymentById } from "@/lib/payments/queries";
import { peso } from "@/lib/payments/balance";
import { ApproveForm } from "./approve-form";
import { RejectForm } from "./reject-form";

type Props = { params: Promise<{ id: string }> };

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function PaymentDetailPage({ params }: Props) {
  const { id } = await params;
  const payment = await getAdminPaymentById(id);
  if (!payment) notFound();

  const isPending = payment.status === "PENDING";

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <PageHeader title="Payment Detail" />

      <div className="bg-card space-y-1 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold">
            {payment.student.firstName} {payment.student.lastName}
          </p>
          {payment.status === "APPROVED" ? (
            <Badge className="border-green-200 bg-green-100 text-green-800">
              Approved
            </Badge>
          ) : payment.status === "REJECTED" ? (
            <Badge variant="destructive">Rejected</Badge>
          ) : (
            <Badge variant="outline">Pending</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">{payment.student.email}</p>
        {payment.student.contactNumber && (
          <p className="text-muted-foreground text-sm">
            {payment.student.contactNumber}
          </p>
        )}
      </div>

      <div className="bg-card space-y-2 rounded-xl border p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Course</span>
          <span className="font-medium">{payment.courseTitle}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Submitted</span>
          <span className="font-medium">
            {dateFormatter.format(payment.createdAt)}
          </span>
        </div>
        <div className="flex items-center justify-between border-t pt-2 text-sm">
          <span className="text-muted-foreground">Amount</span>
          <span className="text-lg font-bold">{peso(payment.amount)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Current enrollment status
          </span>
          <span className="font-medium">
            {payment.enrollmentPaymentStatus === "FULLY_PAID"
              ? "Fully paid"
              : "Partially paid"}
          </span>
        </div>
        <div className="space-y-1 border-t pt-2">
          <BalanceSummary balance={payment.balance} label="Balance now" />
        </div>
      </div>

      <div className="bg-card rounded-xl border p-4">
        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          Proof of payment
        </p>
        <ProofImage src={`/api/admin/payments/${payment.id}/proof`} />
      </div>

      {payment.status === "REJECTED" && payment.adminRemarks && (
        <p className="text-destructive text-sm">
          <strong>Rejection reason:</strong> {payment.adminRemarks}
        </p>
      )}

      {isPending && (
        <div className="bg-card flex flex-col gap-4 rounded-xl border p-4">
          <ApproveForm
            id={payment.id}
            amount={payment.amount}
            totalDue={payment.totalDue}
            approvedPaid={payment.approvedPaid}
            fallbackStatus={payment.enrollmentPaymentStatus}
            catchUpPrefill={payment.catchUpPrefill}
          />
          <div className="border-t pt-4">
            <RejectForm id={payment.id} />
          </div>
        </div>
      )}
    </div>
  );
}
