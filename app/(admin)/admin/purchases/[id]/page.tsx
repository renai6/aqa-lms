import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminPurchaseById } from "@/lib/purchases/queries";
import { peso } from "@/lib/payments/balance";
import { ProofImage } from "@/components/admin/proof-image";
import { ApproveForm } from "./approve-form";
import { RejectForm } from "./reject-form";
import { PaymentStatusForm } from "./payment-status-form";

type Props = { params: Promise<{ id: string }> };

export default async function PurchaseDetailPage({ params }: Props) {
  const { id } = await params;
  const purchase = await getAdminPurchaseById(id);
  if (!purchase) notFound();

  const isPending = purchase.status === "PENDING";

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <PageHeader title="Purchase Detail" />

      <div className="bg-card space-y-1 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold">
            {purchase.student.firstName} {purchase.student.lastName}
          </p>
          <div className="flex items-center gap-2">
            {purchase.payLater && (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-800"
              >
                Pay later
              </Badge>
            )}
            {purchase.status === "APPROVED" ? (
              <Badge className="border-green-200 bg-green-100 text-green-800">
                Approved
              </Badge>
            ) : purchase.status === "REJECTED" ? (
              <Badge variant="destructive">Rejected</Badge>
            ) : (
              <Badge variant="outline">Pending</Badge>
            )}
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          {purchase.student.email}
        </p>
        {purchase.student.contactNumber && (
          <p className="text-muted-foreground text-sm">
            {purchase.student.contactNumber}
          </p>
        )}
      </div>

      <div className="bg-card rounded-xl border p-4">
        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          Courses
        </p>
        <ul className="divide-y">
          {purchase.courses.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span>{c.title}</span>
              <span className="font-semibold">
                {c.tuitionFee != null ? peso(c.tuitionFee) : "—"}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">
            Amount paid ({purchase.paymentType === "FULL" ? "Full" : "Partial"})
          </span>
          <span className="text-lg font-bold">{peso(purchase.amountPaid)}</span>
        </div>
      </div>

      <div className="bg-card rounded-xl border p-4">
        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          Proof of payment
        </p>
        {purchase.payLater ? (
          <p className="text-muted-foreground text-sm">
            No proof submitted - the student chose to pay later.
          </p>
        ) : (
          <ProofImage src={`/api/admin/purchases/${purchase.id}/proof`} />
        )}
      </div>

      <div className="bg-card rounded-xl border p-4">
        <PaymentStatusForm
          id={purchase.id}
          currentStatus={
            purchase.paymentType === "FULL" ? "FULLY_PAID" : "PARTIALLY_PAID"
          }
        />
      </div>

      {purchase.status === "REJECTED" && purchase.adminRemarks && (
        <p className="text-destructive text-sm">
          <strong>Rejection reason:</strong> {purchase.adminRemarks}
        </p>
      )}

      {isPending && (
        <div className="bg-card flex flex-col gap-4 rounded-xl border p-4">
          <ApproveForm
            id={purchase.id}
            courses={purchase.courses}
            amountPaid={purchase.amountPaid}
            payLater={purchase.payLater}
          />
          <div className="border-t pt-4">
            <RejectForm id={purchase.id} />
          </div>
        </div>
      )}
    </div>
  );
}
