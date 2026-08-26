"use client";

import { useActionState, useState } from "react";
import { createPurchaseAction } from "@/lib/purchases/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { PaymentInstructions } from "@/components/payment-instructions";
import type { CheckoutCourse } from "@/lib/purchases/queries";

type Props = { courses: CheckoutCourse[] };

export function CheckoutForm({ courses }: Props) {
  const [state, formAction, isPending] = useActionState(createPurchaseAction, {
    error: null,
  });
  const total = courses.reduce((s, c) => s + (c.tuitionFee ?? 0), 0);
  const [payLater, setPayLater] = useState(false);

  return (
    <form action={formAction} className="space-y-6">
      {courses.map((c) => (
        <input key={c.id} type="hidden" name="courseIds" value={c.id} />
      ))}

      <div className="bg-card divide-y rounded-xl border">
        {courses.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4">
            <span className="text-foreground font-medium">{c.title}</span>
            <span className="text-sm font-semibold">
              {c.tuitionFee != null
                ? `₱${c.tuitionFee.toLocaleString("en-PH")}`
                : "—"}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between p-4">
          <span className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            Total
          </span>
          <span className="text-lg font-bold">
            ₱{total.toLocaleString("en-PH")}
          </span>
        </div>
      </div>

      <PaymentInstructions payLater={payLater} />

      <input type="hidden" name="paymentType" value="PARTIAL" />

      <label className="border-input hover:bg-muted/40 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors">
        <input
          type="checkbox"
          name="payLater"
          checked={payLater}
          onChange={(e) => setPayLater(e.target.checked)}
          className="accent-primary mt-0.5 h-4 w-4 shrink-0"
        />
        <span>
          <span className="text-foreground block text-sm font-medium">
            Pay later
          </span>
          <span className="text-muted-foreground mt-1 block text-xs">
            Submit your enrollment now and pay after it is approved.
          </span>
        </span>
      </label>

      {payLater ? (
        <p className="text-muted-foreground bg-muted/40 rounded-xl border p-4 text-xs">
          An admin will review your request. Once it is approved you are
          enrolled, and the full ₱{total.toLocaleString("en-PH")} shows as your
          outstanding balance until you pay it.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="amountPaid">Amount Paying Now (₱)</Label>
            <Input
              id="amountPaid"
              name="amountPaid"
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
        </>
      )}

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
        {isPending
          ? "Submitting…"
          : payLater
            ? "Submit Enrollment Request"
            : "Submit Payment"}
      </Button>
    </form>
  );
}
