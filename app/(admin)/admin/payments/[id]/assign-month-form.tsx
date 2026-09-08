"use client";

import { useActionState } from "react";
import { assignPaymentMonthAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// Approval is a one-way door, so this is the only way a payment's month gets
// set or corrected afterwards: historical rows, checkout rows, and an admin
// who picked the wrong month on review all arrive here.
export function AssignMonthForm({
  id,
  periodMonth,
  monthOptions,
}: {
  id: string;
  periodMonth: string | null;
  monthOptions: { key: string; label: string }[];
}) {
  const [state, action, isPending] = useActionState(assignPaymentMonthAction, {
    error: null,
  });

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />

      <div>
        <p className="text-sm font-semibold">Month this payment covers</p>
        <p className="text-muted-foreground text-sm">
          {periodMonth
            ? "Change this if it was attributed to the wrong month."
            : "This money is sitting in the monthly tracker's Unassigned column until you say which month it settles."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="periodMonth" className="sr-only">
          Month this payment covers
        </Label>
        <select
          id="periodMonth"
          name="periodMonth"
          defaultValue={periodMonth ?? ""}
          className="border-input bg-background h-10 w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Not assigned to a month</option>
          {monthOptions.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      {!state.error && state.success && (
        <p className="text-sm text-emerald-600">Month updated.</p>
      )}

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Saving…" : "Save month"}
      </Button>
    </form>
  );
}
