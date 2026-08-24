"use client";

import { useActionState, useState } from "react";
import type { PaymentFrequency } from "@prisma/client";
import { approvePurchaseAction } from "./actions";
import { allocate } from "@/lib/purchases/allocation";
import { peso } from "@/lib/payments/balance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ApproveCourse = {
  id: string;
  title: string;
  tuitionFee: number | null;
  paymentFrequency: PaymentFrequency | null;
  priorPaid: number | null;
};

// Only a fixed-total course has a meaningful lifetime total to prefill.
// Monthly and yearly courses are billed per period, which this feature does
// not model, so their totals start blank and the enrollment stays untracked
// unless an admin types one.
//
// Money already approved against an earlier enrollment in the same course is
// added on top. Approving revives that enrollment with its payments still
// attached, so a total of just the tuition fee would count that old money
// against this term and show the student owing less than they do.
function prefillTotal(course: ApproveCourse): string {
  if (course.tuitionFee === null) return "";
  if (
    course.paymentFrequency === "MONTHLY" ||
    course.paymentFrequency === "YEARLY"
  ) {
    return "";
  }
  const centavos =
    Math.round(course.tuitionFee * 100) +
    Math.round((course.priorPaid ?? 0) * 100);
  return String(centavos / 100);
}

export function ApproveForm({
  id,
  courses,
  amountPaid,
}: {
  id: string;
  courses: ApproveCourse[];
  amountPaid: number;
}) {
  const [state, action, isPending] = useActionState(approvePurchaseAction, {
    error: null,
  });

  const prefill = allocate(
    amountPaid,
    courses.map((c) => c.tuitionFee),
  );
  const [applied, setApplied] = useState<string[]>(prefill.map(String));

  // Integer centavos, rounded per field exactly as the server rounds them.
  // Comparing floats here let a split the server would accept leave Approve
  // permanently disabled, with no input the admin could type to satisfy it.
  const appliedTotalCentavos = applied.reduce(
    (sum, value) => sum + Math.round((Number(value) || 0) * 100),
    0,
  );
  const appliedTotal = appliedTotalCentavos / 100;
  const reconciles = appliedTotalCentavos === Math.round(amountPaid * 100);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />

      <div>
        <p className="text-sm font-semibold">Enrollment totals</p>
        <p className="text-muted-foreground text-sm">
          Set what each course costs this student, and how much of the{" "}
          {peso(amountPaid)} received applies to each. Leave a total blank to
          skip balance tracking for that course.
        </p>
      </div>

      <div className="space-y-3">
        {courses.map((course, i) => (
          <div key={course.id} className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">{course.title}</p>
            {course.priorPaid !== null && course.priorPaid > 0 && (
              <p className="text-muted-foreground mb-2 text-xs">
                {peso(course.priorPaid)} is already recorded against this
                student&apos;s earlier enrollment in this course. Approving
                revives that enrollment and keeps those payments, so the total
                below includes them. Lower it if that money should count toward
                this term instead.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`totalDue_${course.id}`}>Total due (₱)</Label>
                <Input
                  id={`totalDue_${course.id}`}
                  name={`totalDue_${course.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={prefillTotal(course)}
                />
              </div>
              <div>
                <Label htmlFor={`applied_${course.id}`}>
                  Amount applied (₱)
                </Label>
                <Input
                  id={`applied_${course.id}`}
                  name={`applied_${course.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={applied[i] ?? ""}
                  onChange={(e) =>
                    setApplied((prev) =>
                      prev.map((v, j) => (j === i ? e.target.value : v)),
                    )
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {!reconciles && (
        <p className="text-destructive text-sm">
          Applied amounts total {peso(appliedTotal)}, but the student paid{" "}
          {peso(amountPaid)}.
        </p>
      )}

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button
        type="submit"
        disabled={isPending || !reconciles}
        className="bg-green-600 hover:bg-green-700"
      >
        {isPending ? "Approving…" : "Approve purchase"}
      </Button>
    </form>
  );
}
