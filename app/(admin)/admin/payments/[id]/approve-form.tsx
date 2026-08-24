"use client";

import { useActionState, useState } from "react";
import { approvePaymentAction } from "./actions";
import { computeBalance, type Balance } from "@/lib/payments/balance";
import { BalanceSummary } from "@/components/admin/balance-summary";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Status = "PARTIALLY_PAID" | "FULLY_PAID";

function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function ApproveForm({
  id,
  amount,
  totalDue,
  approvedPaid,
  fallbackStatus,
  catchUpPrefill,
}: {
  id: string;
  amount: number;
  totalDue: number | null;
  approvedPaid: number;
  fallbackStatus: Status;
  catchUpPrefill?: { totalDue: string; alreadyPaid: string | null } | null;
}) {
  const [state, action, isPending] = useActionState(approvePaymentAction, {
    error: null,
  });

  // The catch-up fields decide the balance, so the projection below has to read
  // them as they are typed. Server-rendering it from the stored totalDue showed
  // "not tracked" in exactly the case the admin is setting a total in.
  const [totalDueText, setTotalDueText] = useState(
    catchUpPrefill?.totalDue ?? "",
  );
  const [alreadyPaidText, setAlreadyPaidText] = useState(
    catchUpPrefill?.alreadyPaid ?? "",
  );

  const effectiveTotalDue = catchUpPrefill
    ? parseAmount(totalDueText)
    : totalDue;
  // Mirrors the action's `writeCatchUp`: the field only counts when it is
  // offered at all, and a blank or zero entry adds nothing.
  const catchUp =
    catchUpPrefill?.alreadyPaid !== null && catchUpPrefill !== null
      ? (parseAmount(alreadyPaidText) ?? 0)
      : 0;

  const projected: Balance =
    effectiveTotalDue === null
      ? { kind: "untracked" }
      : computeBalance(effectiveTotalDue, [approvedPaid, catchUp, amount]);

  // The projection picks the status, until the admin picks one themselves.
  const [override, setOverride] = useState<Status | null>(null);
  const derived: Status =
    projected.kind === "tracked"
      ? projected.remaining <= 0
        ? "FULLY_PAID"
        : "PARTIALLY_PAID"
      : fallbackStatus;
  const status = override ?? derived;

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
                value={totalDueText}
                onChange={(e) => setTotalDueText(e.target.value)}
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
                  value={alreadyPaidText}
                  onChange={(e) => setAlreadyPaidText(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-md border p-3">
        <BalanceSummary balance={projected} label="After approving" />
      </div>

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
            checked={status === "PARTIALLY_PAID"}
            onChange={() => setOverride("PARTIALLY_PAID")}
          />
          <span>Partially paid</span>
        </Label>
        <Label className="flex items-center gap-2 rounded-md border p-3">
          <input
            type="radio"
            name="paymentStatus"
            value="FULLY_PAID"
            checked={status === "FULLY_PAID"}
            onChange={() => setOverride("FULLY_PAID")}
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
