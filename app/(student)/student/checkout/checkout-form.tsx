"use client";

import { useActionState } from "react";
import { createPurchaseAction } from "@/lib/purchases/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import type { CheckoutCourse } from "@/lib/purchases/queries";

type Props = { courses: CheckoutCourse[] };

export function CheckoutForm({ courses }: Props) {
  const [state, formAction, isPending] = useActionState(createPurchaseAction, {
    error: null,
  });
  const total = courses.reduce((s, c) => s + (c.tuitionFee ?? 0), 0);

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

      <div className="bg-muted/40 space-y-4 rounded-xl border p-4">
        <div>
          <h2 className="text-foreground text-sm font-semibold">
            Where to send your payment
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Pay via bank transfer or GCash, then upload your proof of payment
            below.
          </p>
        </div>

        <div className="space-y-1 rounded-lg border border-[#b03a48]/25 bg-[#f7e6e8] p-3">
          <p className="text-xs font-semibold tracking-wide text-[#8a2a36] uppercase">
            BPI
          </p>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Account Name</span>
            <span className="text-foreground text-right font-medium">
              AQA-Online Islamic School
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Account Number</span>
            <span className="text-foreground text-right font-medium tabular-nums">
              2129356823
            </span>
          </div>
        </div>

        <div className="space-y-1 rounded-lg border border-[#2a6fb0]/25 bg-[#e6f0fa] p-3">
          <p className="text-xs font-semibold tracking-wide text-[#1e5a94] uppercase">
            GCash
          </p>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Number</span>
            <span className="text-foreground text-right font-medium tabular-nums">
              09970767501
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Name</span>
            <span className="text-foreground text-right font-medium">
              Malihah M.
            </span>
          </div>
        </div>
      </div>

      <input type="hidden" name="paymentType" value="PARTIAL" />

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
          JPG, PNG, or WEBP. Max 5MB.
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
