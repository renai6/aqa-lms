"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Eyebrow from "@/components/homepage/Eyebrow";

export function LoginForm({ courseId }: { courseId?: string }) {
  const [state, action, isPending] = useActionState(loginAction, {
    error: null,
  });

  const registerHref = courseId
    ? `/register?courseId=${courseId}`
    : "/register";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 w-full max-w-[380px] duration-500">
      {/* AQA mark — visible on mobile (left panel is hidden) */}
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <div className="border-primary/40 bg-primary/[0.07] flex h-9 w-9 shrink-0 rotate-45 items-center justify-center border-[1.5px]">
          <span className="text-primary -rotate-45 text-[10px] font-bold tracking-tighter">
            AQA
          </span>
        </div>
        <span className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
          Al-Qur&apos;an Academy
        </span>
      </div>

      {/* Heading */}
      <div className="mb-8">
        <Eyebrow className="mb-4">Member Login</Eyebrow>
        <h2 className="text-foreground text-[1.75rem] leading-none font-bold tracking-tight">
          Welcome back
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Sign in to continue your learning journey.
        </p>
      </div>

      {/* Form */}
      <form action={action} className="space-y-5">
        {courseId && <input type="hidden" name="courseId" value={courseId} />}
        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-foreground text-sm font-medium"
          >
            Email address
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="ahmad@example.com"
            className="h-11 px-3.5 text-sm"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-foreground text-sm font-medium"
            >
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-primary text-xs font-medium transition-opacity hover:opacity-70"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="off"
            className="h-11 px-3.5 text-sm"
          />
        </div>

        {state.error && (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm font-medium">
            {state.error}
          </div>
        )}

        <Button
          type="submit"
          className="mt-1 h-11 w-full font-semibold tracking-wide"
          disabled={isPending}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 shrink-0 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Signing in…
            </span>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      {/* Register CTA */}
      <div className="border-border/60 mt-7 border-t pt-6 text-center">
        <p className="text-muted-foreground text-sm">
          New here?{" "}
          <Link
            href={registerHref}
            className="text-primary font-medium transition-opacity hover:opacity-80"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
