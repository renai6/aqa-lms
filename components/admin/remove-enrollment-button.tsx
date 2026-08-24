"use client";

import { useActionState } from "react";
import {
  removeEnrollmentAction,
  restoreEnrollmentAction,
} from "@/lib/enrollments/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  isRemoved: boolean;
};

export function RemoveEnrollmentButton({
  enrollmentId,
  studentName,
  courseTitle,
  isRemoved,
}: Props) {
  const [removeState, removeAction, isRemoving] = useActionState(
    removeEnrollmentAction,
    { error: null },
  );
  const [restoreState, restoreAction, isRestoring] = useActionState(
    restoreEnrollmentAction,
    { error: null },
  );

  // Restoring only gives access back, so it skips the dialog. Removing cuts the
  // student off from the course, so it gets one deliberate confirmation step.
  if (isRemoved) {
    return (
      <form action={restoreAction}>
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={isRestoring}
          aria-label={`Restore ${studentName} to ${courseTitle}`}
        >
          {isRestoring ? "Restoring..." : "Restore"}
        </Button>
        {restoreState.error && (
          <p className="text-destructive mt-1 text-xs">{restoreState.error}</p>
        )}
      </form>
    );
  }

  const formId = `remove-enrollment-${enrollmentId}`;

  return (
    <>
      {/* AlertDialogContent wraps itself in AlertDialogPortal and renders into
          document.body, outside this form. The form={formId} attribute on the
          reason field and the confirm button is what associates them with this
          form, and must not be removed. */}
      <form action={removeAction} id={formId}>
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
      </form>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRemoving}
            aria-label={`Remove ${studentName} from ${courseTitle}`}
            className="text-destructive hover:text-destructive"
          >
            {isRemoving ? "Removing..." : "Remove"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {studentName} from {courseTitle}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The course disappears from their dashboard and they lose access to
              its lessons, assessments and certificate. Their payments, grades
              and progress are kept, and you can restore them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-reason`}>
              Reason <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id={`${formId}-reason`}
              name="reason"
              form={formId}
              rows={2}
              placeholder="e.g. Transferred to Marhala 2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              form={formId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {removeState.error && (
        <p className="text-destructive mt-1 text-xs">{removeState.error}</p>
      )}
    </>
  );
}
