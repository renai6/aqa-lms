"use client";

import { useActionState } from "react";
import { approvePaymentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function ApproveForm({
  id,
  defaultStatus,
  catchUpPrefill,
}: {
  id: string;
  defaultStatus: "PARTIALLY_PAID" | "FULLY_PAID";
  catchUpPrefill?: { totalDue: string; alreadyPaid: string | null } | null;
}) {
  const [state, action, isPending] = useActionState(approvePaymentAction, {
    error: null,
  });

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />

      {catchUpPrefill && (
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <div>
            <p className="text-sm font-semibold">Start tracking this balance</p>
            <p className="text-muted-foreground text-sm">
              {catchUpPrefill.alreadyPaid !== null
                ? "This enrollment has no agreed total yet. Set one to see the remaining balance from now on, or leave it blank to keep deciding by hand."
                : "This enrollment's checkout payment is already recorded. Set a total to see the remaining balance from now on, or leave it blank to keep deciding by hand."}
            </p>
          </div>
          <div
            className={
              catchUpPrefill.alreadyPaid !== null
                ? "grid gap-3 sm:grid-cols-2"
                : "grid gap-3"
            }
          >
            <div>
              <Label htmlFor="totalDue">Total due (₱)</Label>
              <Input
                id="totalDue"
                name="totalDue"
                type="number"
                min="0"
                step="0.01"
                defaultValue={catchUpPrefill.totalDue}
              />
            </div>
            {catchUpPrefill.alreadyPaid !== null && (
              <div>
                <Label htmlFor="alreadyPaid">
                  Already paid, before this (₱)
                </Label>
                <Input
                  id="alreadyPaid"
                  name="alreadyPaid"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={catchUpPrefill.alreadyPaid}
                />
              </div>
            )}
          </div>
        </div>
      )}

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
            defaultChecked={defaultStatus === "PARTIALLY_PAID"}
          />
          <span>Partially paid</span>
        </Label>
        <Label className="flex items-center gap-2 rounded-md border p-3">
          <input
            type="radio"
            name="paymentStatus"
            value="FULLY_PAID"
            defaultChecked={defaultStatus === "FULLY_PAID"}
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
