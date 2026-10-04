"use client";

import { useState } from "react";
import { useActionState } from "react";
import { moveEnrollmentCourseAction } from "@/lib/enrollments/actions";
import type { CourseMoveOption } from "@/lib/enrollments/move-options";
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
  AlertDialogAction,
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
  // Course A's agreed total, pre-filled so a same-price move is one click.
  // Null means course A is untracked, and course B will be too.
  totalDue: number | null;
  // Already narrowed by courseMoveOptions for this enrollment.
  courses: CourseMoveOption[];
};

export function MoveEnrollmentCourseButton({
  enrollmentId,
  studentName,
  courseTitle,
  totalDue,
  courses,
}: Props) {
  const [state, action, isMoving] = useActionState(
    moveEnrollmentCourseAction,
    { error: null },
  );
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [total, setTotal] = useState("");

  if (courses.length === 0) return null;

  const formId = `move-course-${enrollmentId}`;
  const selected = courses.find((c) => c.id === courseId);
  const isMonthly = selected?.paymentFrequency === "MONTHLY";

  return (
    <>
      {/* AlertDialogContent portals into document.body, outside this form, so
          the fields and the confirm button reach it through form={formId}.
          Same constraint as MoveEnrollmentButton - do not remove. */}
      <form action={action} id={formId}>
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
      </form>
      {/* Reset on open, not on close, for the reason MoveEnrollmentButton
          documents: clearing on close disables the confirm button before the
          browser submits the form. */}
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) return;
          setCourseId("");
          setBatchId("");
          setTotal(totalDue === null ? "" : String(totalDue));
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isMoving}
            aria-label={`Move ${studentName} to another course`}
          >
            {isMoving ? "Changing..." : "Change course"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move {studentName} to another course
            </AlertDialogTitle>
            <AlertDialogDescription>
              Their payments move with them and they are removed from{" "}
              {courseTitle}. Progress in {courseTitle} does not carry over.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-course`}>Course</Label>
              <Select
                value={courseId}
                onValueChange={(v) => {
                  setCourseId(v);
                  setBatchId("");
                }}
              >
                <SelectTrigger id={`${formId}-course`} className="w-full">
                  <SelectValue placeholder="Choose a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem
                      key={c.id}
                      value={c.id}
                      disabled={c.disabledReason !== null}
                    >
                      {c.title}
                      {c.disabledReason && ` - ${c.disabledReason}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="courseId"
                form={formId}
                value={courseId}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-batch`}>Batch</Label>
              <Select
                value={batchId}
                onValueChange={setBatchId}
                disabled={!selected}
              >
                <SelectTrigger id={`${formId}-batch`} className="w-full">
                  <SelectValue placeholder="Choose a batch" />
                </SelectTrigger>
                <SelectContent>
                  {selected?.batches.map((b) => (
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
            {/* Monthly courses track a per-month ledger, not a single total.
                An untracked course A keeps course B untracked server-side, so
                the field would only collect a number that is thrown away. */}
            {selected && !isMonthly && totalDue === null && (
              <p className="text-muted-foreground text-sm">
                This enrollment has no tracked balance, so the new course will
                not track one either.
              </p>
            )}
            {selected && !isMonthly && totalDue !== null && (
              <div className="space-y-2">
                <Label htmlFor={`${formId}-total`}>Total due</Label>
                <Input
                  id={`${formId}-total`}
                  name="totalDue"
                  form={formId}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Leave empty to not track a balance"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              form={formId}
              disabled={!courseId || !batchId}
            >
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
