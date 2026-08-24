"use client";

import { useActionState } from "react";
import { rejectPaymentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function RejectForm({ id }: { id: string }) {
  const [state, action, isPending] = useActionState(rejectPaymentAction, {
    error: null,
  });

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Label htmlFor="reason">Rejection reason</Label>
      <Textarea
        id="reason"
        name="reason"
        required
        rows={3}
        placeholder="Explain why this payment is rejected"
      />
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? "Rejecting…" : "Reject payment"}
      </Button>
    </form>
  );
}
