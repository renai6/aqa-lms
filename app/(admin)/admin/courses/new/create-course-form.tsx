"use client";

import { useActionState } from "react";
import { createCourseAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export function CreateCourseForm() {
  const [state, formAction, isPending] = useActionState(createCourseAction, {
    error: null,
  });
  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              required
              placeholder="e.g. Qur'an Recitation Basics"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Brief course description..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>
              Course Type <span aria-hidden="true">*</span>
            </Label>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="courseType"
                  value="ON_SITE"
                  defaultChecked
                  className="accent-primary"
                />
                On-Site
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="courseType"
                  value="ONLINE"
                  className="accent-primary"
                />
                Online
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meetLink">Google Meet Link</Label>
            <Input
              id="meetLink"
              name="meetLink"
              type="url"
              placeholder="https://meet.google.com/xxx-xxxx-xxx"
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
                  defaultChecked
                  className="accent-primary"
                />
                Not specified
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="courseDuration"
                  value="SHORT"
                  className="accent-primary"
                />
                Short
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="courseDuration"
                  value="LONG"
                  className="accent-primary"
                />
                Long
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                name="groupName"
                placeholder="e.g. Marhala"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <Input
                id="level"
                name="level"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 1"
              />
            </div>
            <p className="text-muted-foreground text-xs sm:col-span-3">
              Courses sharing a group name are collapsed into one listing (e.g.
              &ldquo;Marhala 1/2/3&rdquo; shown as &ldquo;Marhala&rdquo;). Level
              orders them. Leave blank for a standalone course.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="passingGrade">Passing Grade (%)</Label>
            <Input
              id="passingGrade"
              name="passingGrade"
              type="number"
              min="0"
              max="100"
              step="0.1"
              defaultValue="75"
            />
          </div>
          {state.error && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create Course"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
