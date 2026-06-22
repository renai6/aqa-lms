'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { loginAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [state, action, isPending] = useActionState(loginAction, { error: null })

  return (
    <div className="w-full max-w-[380px] animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* AQA mark — visible on mobile (left panel is hidden) */}
      <div className="lg:hidden flex items-center gap-2.5 mb-8">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{
            border: '1.5px solid oklch(0.525 0.223 3.958 / 0.4)',
            backgroundColor: 'oklch(0.525 0.223 3.958 / 0.07)',
          }}
        >
          <span
            className="font-bold text-[10px] tracking-tighter"
            style={{ color: 'oklch(0.525 0.223 3.958)' }}
          >
            AQA
          </span>
        </div>
        <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Al-Qur&apos;an Academy
        </span>
      </div>

      {/* Heading */}
      <div className="mb-8">
        <h2 className="text-[1.75rem] font-bold text-foreground tracking-tight leading-none">
          Welcome back
        </h2>
        <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
          Sign in to continue your learning journey.
        </p>
      </div>

      {/* Form */}
      <form action={action} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">
            Email address
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 text-sm px-3.5"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: 'oklch(0.525 0.223 3.958)' }}
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-11 text-sm px-3.5"
          />
        </div>

        {state.error && (
          <div
            className="rounded-lg px-4 py-3 text-sm font-medium"
            style={{
              backgroundColor: 'oklch(0.577 0.245 27.325 / 0.08)',
              border: '1px solid oklch(0.577 0.245 27.325 / 0.2)',
              color: 'oklch(0.577 0.245 27.325)',
            }}
          >
            {state.error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 font-semibold tracking-wide mt-1"
          disabled={isPending}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4 shrink-0"
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
            'Sign in'
          )}
        </Button>
      </form>

      {/* Divider + course CTA (mobile) */}
      <div className="lg:hidden mt-7 pt-6 border-t border-border/60 text-center">
        <p className="text-sm text-muted-foreground">
          Not enrolled yet?{' '}
          <Link
            href="/courses"
            className="font-medium hover:opacity-80 transition-opacity"
            style={{ color: 'oklch(0.525 0.223 3.958)' }}
          >
            Browse our courses
          </Link>
        </p>
      </div>
    </div>
  )
}
