import { RegisterForm } from "./register-form";
import Eyebrow from "@/components/homepage/Eyebrow";

export const metadata = { title: "Create an account — Al-Qur'an Academy" };

export default function RegisterPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 w-full max-w-[420px] duration-500">
      <div className="mb-8">
        <Eyebrow className="mb-4">Join AQA</Eyebrow>
        <h2 className="text-foreground text-[1.75rem] leading-none font-bold tracking-tight">
          Create your account
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Register to browse and purchase courses.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
