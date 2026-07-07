"use client";

import { useActionState } from "react";
import { updateCourseAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CourseDetail } from "@/lib/courses/queries";

type Props = { course: CourseDetail };

export function EditCourseForm({ course }: Props) {
  const [state, formAction, isPending] = useActionState(updateCourseAction, {
    error: null,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={course.id} />
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              name="title"
              required
              defaultValue={course.title}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              name="description"
              rows={3}
              defaultValue={course.description ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label>Course Type</Label>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="courseType"
                  value="ON_SITE"
                  defaultChecked={course.courseType === "ON_SITE"}
                  className="accent-primary"
                />
                On-Site
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="courseType"
                  value="ONLINE"
                  defaultChecked={course.courseType === "ONLINE"}
                  className="accent-primary"
                />
                Online
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-meetLink">Google Meet Link</Label>
            <Input
              id="edit-meetLink"
              name="meetLink"
              type="url"
              placeholder="https://meet.google.com/xxx-xxxx-xxx"
              defaultValue={course.meetLink ?? ""}
            />
            <p className="text-muted-foreground text-xs">
              Only applicable for Online courses.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Course Duration</Label>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="courseDuration"
                  value=""
                  defaultChecked={!course.courseDuration}
                  className="accent-primary"
                />
                Not specified
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="courseDuration"
                  value="SHORT"
                  defaultChecked={course.courseDuration === "SHORT"}
                  className="accent-primary"
                />
                Short
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="courseDuration"
                  value="LONG"
                  defaultChecked={course.courseDuration === "LONG"}
                  className="accent-primary"
                />
                Long
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-groupName">Group Name</Label>
              <Input
                id="edit-groupName"
                name="groupName"
                placeholder="e.g. Marhala"
                defaultValue={course.groupName ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-level">Level</Label>
              <Input
                id="edit-level"
                name="level"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 1"
                defaultValue={course.level != null ? String(course.level) : ""}
              />
            </div>
            <p className="text-muted-foreground text-xs sm:col-span-3">
              Courses sharing a group name are collapsed into one listing (e.g.
              &ldquo;Marhala 1/2/3&rdquo; shown as &ldquo;Marhala&rdquo;). Level
              orders them. Leave blank for a standalone course.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-passingGrade">Passing Grade (%)</Label>
            <Input
              id="edit-passingGrade"
              name="passingGrade"
              type="number"
              min="0"
              max="100"
              step="0.1"
              defaultValue={String(course.passingGrade)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-tuitionFee">Tuition Fee (₱)</Label>
            <Input
              id="edit-tuitionFee"
              name="tuitionFee"
              type="number"
              min="0"
              step="0.01"
              defaultValue={
                course.tuitionFee !== null ? String(course.tuitionFee) : ""
              }
              placeholder="e.g. 10000"
            />
            <p className="text-muted-foreground text-xs">
              Leave blank if not applicable.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Payment Frequency</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="paymentFrequency"
                  value=""
                  defaultChecked={!course.paymentFrequency}
                  className="accent-primary"
                />
                Not specified
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="paymentFrequency"
                  value="MONTHLY"
                  defaultChecked={course.paymentFrequency === "MONTHLY"}
                  className="accent-primary"
                />
                Monthly
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="paymentFrequency"
                  value="ONE_TIME"
                  defaultChecked={course.paymentFrequency === "ONE_TIME"}
                  className="accent-primary"
                />
                One-time
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="paymentFrequency"
                  value="YEARLY"
                  defaultChecked={course.paymentFrequency === "YEARLY"}
                  className="accent-primary"
                />
                Yearly
              </label>
            </div>
            <p className="text-muted-foreground text-xs">
              Shown next to the price, e.g. &ldquo;₱2,000 / month&rdquo;.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-miscFeeNote">Miscellaneous Fee Note</Label>
            <Textarea
              id="edit-miscFeeNote"
              name="miscFeeNote"
              rows={2}
              maxLength={300}
              defaultValue={course.miscFeeNote ?? ""}
              placeholder="e.g. Price excludes a miscellaneous fee."
            />
            <p className="text-muted-foreground text-xs">
              Shown under the price. Leave blank to hide.
            </p>
          </div>
          {state.error && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}
          {state.success && !state.error && (
            <p className="text-sm text-green-600">Saved successfully.</p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
