"use client";

import { useActionState } from "react";
import { createPaymentAction } from "@/lib/payments/actions";
import { PaymentInstructions } from "@/components/payment-instructions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export function PaymentForm({ enrollmentId }: { enrollmentId: string }) {
  const [state, formAction, isPending] = useActionState(createPaymentAction, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />

      <PaymentInstructions />

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
