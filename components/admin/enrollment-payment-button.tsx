"use client";

import { startTransition, useActionState, useState } from "react";
import {
  logAdminPaymentAction,
  setTotalDueAction,
} from "@/lib/payments/admin-actions";
import type { EnrollmentBilling } from "@/lib/payments/enrollment-billing";
import { balanceTone } from "@/components/admin/balance-summary";
import { describeBalance } from "@/lib/payments/balance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  enrollmentId: string;
  studentName: string;
  courseTitle: string;
  billing: EnrollmentBilling;
};

export function EnrollmentPaymentButton({
  enrollmentId,
  studentName,
  courseTitle,
  billing,
}: Props) {
  // Controlled so a successful save can close it. A failed one keeps it open
  // with the error beside the field.
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Payments for ${studentName} in ${courseTitle}`}
        >
          Payment
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Payments for {courseTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            Paid is the sum of approved payments. To change it, log the money
            received.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* min-w-0: the dialog is a grid, and a long balance line would
            otherwise widen this column past the dialog's edge on phones. */}
        <div className="min-w-0">
          <PaymentForms
            enrollmentId={enrollmentId}
            billing={billing}
            onSaved={() => setOpen(false)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Lives inside the dialog content, which unmounts on close, so a reopened
// dialog starts from fresh prefills and without the last attempt's error.
//
// The close is wrapped in startTransition because a state update after an
// `await` falls out of the action's transition and commits at once. Unwrapped,
// the dialog closed a second or more before the refreshed row arrived, so the
// admin saw the old figures and could take the save for a failure.
function PaymentForms({
  enrollmentId,
  billing,
  onSaved,
}: {
  enrollmentId: string;
  billing: EnrollmentBilling;
  onSaved: () => void;
}) {
  const [totalState, totalAction, isSavingTotal] = useActionState(
    async (prev: { error: string | null }, formData: FormData) => {
      const result = await setTotalDueAction(prev, formData);
      if (!result.error) startTransition(onSaved);
      return result;
    },
    { error: null },
  );
  const [logState, logAction, isLogging] = useActionState(
    async (prev: { error: string | null }, formData: FormData) => {
      const result = await logAdminPaymentAction(prev, formData);
      if (!result.error) startTransition(onSaved);
      return result;
    },
    { error: null },
  );
  const [month, setMonth] = useState(billing.defaultMonth ?? "");
  const busy = isSavingTotal || isLogging;

  return (
    <div className="space-y-4">
      {/* Stacked rather than BalanceSummary's label-beside-value row: at
          dialog width the line wrapped into a ragged right-hand column. */}
      <div className="space-y-0.5 text-sm">
        <p className="text-muted-foreground">Balance</p>
        <p
          className={`font-medium ${balanceTone(billing.balance, billing.monthlyLine)}`}
        >
          {billing.monthlyLine ?? describeBalance(billing.balance)}
        </p>
      </div>

      {billing.totalPrefill !== null && (
        <form action={totalAction} className="space-y-3 border-t pt-4">
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <div className="space-y-2">
            <Label htmlFor={`total-${enrollmentId}`}>Total due (₱)</Label>
            <Input
              id={`total-${enrollmentId}`}
              name="totalDue"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              required
              defaultValue={billing.totalPrefill}
            />
          </div>
          {/* Only while the checkout money is missing from the ledger. Once
              it is recorded, entering it again would count it twice. */}
          {billing.alreadyPaidPrefill !== null && (
            <div className="space-y-2">
              <Label htmlFor={`already-${enrollmentId}`}>
                Already paid at checkout (₱)
              </Label>
              <Input
                id={`already-${enrollmentId}`}
                name="alreadyPaid"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                defaultValue={billing.alreadyPaidPrefill}
              />
              <p className="text-muted-foreground text-xs">
                This balance is not tracked yet. Money received before now is
                recorded as the checkout payment.
              </p>
            </div>
          )}
          {totalState.error && (
            <p className="text-destructive text-xs">{totalState.error}</p>
          )}
          <Button type="submit" size="sm" disabled={busy}>
            {isSavingTotal ? "Saving..." : "Save total"}
          </Button>
        </form>
      )}

      <form action={logAction} className="space-y-3 border-t pt-4">
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <p className="text-sm font-medium">Log a payment</p>
        <div className="space-y-2">
          <Label htmlFor={`amount-${enrollmentId}`}>Amount (₱)</Label>
          <Input
            id={`amount-${enrollmentId}`}
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            required
          />
        </div>
        {billing.isMonthly && (
          <div className="space-y-2">
            <Label htmlFor={`month-${enrollmentId}`}>Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger id={`month-${enrollmentId}`} className="w-full">
                <SelectValue placeholder="Choose a month" />
              </SelectTrigger>
              <SelectContent>
                {billing.monthOptions.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="periodMonth" value={month} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor={`note-${enrollmentId}`}>Note (optional)</Label>
          <Input
            id={`note-${enrollmentId}`}
            name="note"
            maxLength={200}
            placeholder="e.g. Cash at the front desk"
          />
        </div>
        {logState.error && (
          <p className="text-destructive text-xs">{logState.error}</p>
        )}
        <Button type="submit" size="sm" disabled={busy}>
          {isLogging ? "Logging..." : "Log payment"}
        </Button>
      </form>
    </div>
  );
}
