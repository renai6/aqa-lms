"use client";

import { useActionState } from "react";
import { createUserAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  role: "ADMIN" | "TEACHER";
  roleLabel: string;
};

export function CreateUserForm({ role, roleLabel }: Props) {
  const [state, formAction, isPending] = useActionState(createUserAction, {
    error: null,
  });
  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="role" value={role} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">
                First Name <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="firstName"
                name="firstName"
                required
                placeholder="Ahmad"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">
                Last Name <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="lastName"
                name="lastName"
                required
                placeholder="Bayan"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="ahmad@example.com"
            />
          </div>
          {state.error && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : `Create ${roleLabel}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
