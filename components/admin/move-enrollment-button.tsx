"use client";

import { useState } from "react";
import { useActionState } from "react";
import { moveEnrollmentBatchAction } from "@/lib/enrollments/actions";
import { batchCoverageNote } from "@/lib/batches/coverage";
import { Button } from "@/components/ui/button";
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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type MoveBatchOption = { id: string; label: string; covered: number };

type Props = {
  enrollmentId: string;
  studentName: string;
  currentBatchLabel: string | null;
  // Every batch of the course except the one the student is already in.
  batches: MoveBatchOption[];
  totalLessons: number;
};

export function MoveEnrollmentButton({
  enrollmentId,
  studentName,
  currentBatchLabel,
  batches,
  totalLessons,
}: Props) {
  const [state, action, isMoving] = useActionState(moveEnrollmentBatchAction, {
    error: null,
  });
  const [batchId, setBatchId] = useState("");

  // A course with a single batch has nowhere to move anyone, so the button
  // would only ever open an empty picker.
  if (batches.length === 0) return null;

  const formId = `move-enrollment-${enrollmentId}`;
  const selected = batches.find((b) => b.id === batchId);
  const note = selected
    ? batchCoverageNote(selected.covered, totalLessons)
    : null;

  return (
    <>
      {/* AlertDialogContent portals into document.body, outside this form, so
          the batch field and the confirm button reach it through form={formId}.
          Same constraint as RemoveEnrollmentButton - do not remove. */}
      <form action={action} id={formId}>
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
      </form>
      <AlertDialog onOpenChange={(open) => !open && setBatchId("")}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isMoving}
            aria-label={`Move ${studentName} to another batch`}
          >
            {isMoving ? "Moving..." : "Move"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {studentName} to another batch</AlertDialogTitle>
            <AlertDialogDescription>
              Their progress, grades, payments and certificate stay with them.
              Only the lesson materials, recordings and videos change, because
              those come from the batch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Current batch: </span>
              <span className="font-medium">
                {currentBatchLabel ?? "None assigned"}
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-batch`}>Move to</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger id={`${formId}-batch`} className="w-full">
                  <SelectValue placeholder="Choose a batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="batchId"
                form={formId}
                value={batchId}
              />
            </div>
            {note && (
              <p className="text-muted-foreground bg-muted rounded-md px-3 py-2 text-xs">
                {note}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" form={formId} disabled={!batchId}>
              Move
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.error && (
        <p className="text-destructive mt-1 text-xs">{state.error}</p>
      )}
    </>
  );
}
