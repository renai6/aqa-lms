"use client";

import { useActionState } from "react";
import { approvePaymentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function ApproveForm({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
}) {
  const [state, action, isPending] = useActionState(approvePaymentAction, {
    error: null,
  });

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <p className="text-sm font-semibold">Resulting payment status</p>
        <p className="text-muted-foreground text-sm">
          Approving records this payment. Choose where the enrollment stands
          afterwards.
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

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button
        type="submit"
        disabled={isPending}
        className="bg-green-600 hover:bg-green-700"
      >
        {isPending ? "Approving…" : "Approve payment"}
      </Button>
    </form>
  );
}
