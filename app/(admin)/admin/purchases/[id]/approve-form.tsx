"use client";

import { useActionState, useState } from "react";
import type { PaymentFrequency } from "@prisma/client";
import { approvePurchaseAction } from "./actions";
import { allocate } from "@/lib/purchases/allocation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ApproveCourse = {
  id: string;
  title: string;
  tuitionFee: number | null;
  paymentFrequency: PaymentFrequency | null;
};

// Only a fixed-total course has a meaningful lifetime total to prefill.
// Monthly and yearly courses are billed per period, which this feature does
// not model, so their totals start blank and the enrollment stays untracked
// unless an admin types one.
function prefillTotal(course: ApproveCourse): string {
  if (course.tuitionFee === null) return "";
  if (
    course.paymentFrequency === "MONTHLY" ||
    course.paymentFrequency === "YEARLY"
  ) {
    return "";
  }
  return String(course.tuitionFee);
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

  const appliedTotal =
    Math.round(
      applied.reduce((sum, value) => sum + (Number(value) || 0), 0) * 100,
    ) / 100;
  const reconciles = appliedTotal === amountPaid;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />

      <div>
        <p className="text-sm font-semibold">Enrollment totals</p>
        <p className="text-muted-foreground text-sm">
          Set what each course costs this student, and how much of the ₱
          {amountPaid.toLocaleString("en-PH")} received applies to each. Leave a
          total blank to skip balance tracking for that course.
        </p>
      </div>

      <div className="space-y-3">
        {courses.map((course, i) => (
          <div key={course.id} className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">{course.title}</p>
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
          Applied amounts total ₱{appliedTotal.toLocaleString("en-PH")}, but the
          student paid ₱{amountPaid.toLocaleString("en-PH")}.
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
