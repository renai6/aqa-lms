"use client";

import { useActionState } from "react";
import { updatePaymentStatusAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function PaymentStatusForm({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
}) {
  const [state, action, isPending] = useActionState(updatePaymentStatusAction, {
    error: null,
  });

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <p className="text-sm font-semibold">Update payment status</p>
        <p className="text-sm text-muted-foreground">
          Choose the payment state for this purchase.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2 rounded-md border p-3">
          <input
            type="radio"
            name="paymentStatus"
            value="PARTIALLY_PAID"
            defaultChecked={currentStatus === "PARTIALLY_PAID"}
          />
          <span>Partially paid</span>
        </Label>
        <Label className="flex items-center gap-2 rounded-md border p-3">
          <input
            type="radio"
            name="paymentStatus"
            value="FULLY_PAID"
            defaultChecked={currentStatus === "FULLY_PAID"}
          />
          <span>Fully paid</span>
        </Label>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-600">Payment status updated.</p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save payment status"}
      </Button>
    </form>
  );
}
