"use client";

import { useActionState } from "react";
import { createPaymentAction } from "@/lib/payments/actions";
import { PaymentInstructions } from "@/components/payment-instructions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import type { SelectableMonth } from "@/lib/payments/monthly";
import { peso } from "@/lib/payments/balance";

export function PaymentForm({
  enrollmentId,
  months,
}: {
  enrollmentId: string;
  months: SelectableMonth[];
}) {
  const [state, formAction, isPending] = useActionState(createPaymentAction, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />

      <PaymentInstructions />

      {months.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="periodMonth">Paying For</Label>
          <select
            id="periodMonth"
            name="periodMonth"
            required
            defaultValue={months[0].key}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
                {m.status.kind === "partial"
                  ? ` (${peso(m.status.short)} remaining)`
                  : ""}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            This course is billed monthly. Pick the month this payment covers.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="amount">Amount Paying Now (₱)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          min="1"
          step="0.01"
          required
          placeholder="e.g. 5000"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">Proof of Payment</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
        <p className="text-muted-foreground text-xs">
          JPG, PNG, or WEBP. Max 10MB.
        </p>
      </div>

      {state.error && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border px-4 py-3 text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="h-11 w-full font-semibold"
      >
        {isPending ? "Submitting…" : "Submit Payment"}
      </Button>
    </form>
  );
}
