import { type Metadata } from 'next'
import { ChangePasswordForm } from './change-password-form'

export const metadata: Metadata = {
  title: "Set Your Password — Al-Qur'an Academy",
}

export default function ChangePasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Set Your Password</h1>
          <p className="text-sm text-muted-foreground">
            Please set a new password before continuing.
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  )
}
