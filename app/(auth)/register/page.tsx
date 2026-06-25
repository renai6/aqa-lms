import { RegisterForm } from './register-form'

export const metadata = { title: "Create an account — Al-Qur'an Academy" }

export default function RegisterPage() {
  return (
    <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="mb-8">
        <h2 className="text-[1.75rem] font-bold text-foreground tracking-tight leading-none">
          Create your account
        </h2>
        <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
          Register to browse and purchase courses.
        </p>
      </div>
      <RegisterForm />
    </div>
  )
}
