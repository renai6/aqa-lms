import { getAccountSession, getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getCheckoutCourses } from "@/lib/purchases/queries";
import { CheckoutForm } from "./checkout-form";

export const metadata = { title: "Checkout — AQA" };

type Props = { searchParams: Promise<{ ids?: string }> };

export default async function CheckoutPage({ searchParams }: Props) {
  const [session, account] = await Promise.all([getSession(), getAccountSession()]);
  if (!session || session.role !== "STUDENT") redirect("/login");

  const { ids } = await searchParams;
  const courseIds = (ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (courseIds.length === 0) redirect("/student/courses");

  const courses = await getCheckoutCourses(session.userId, courseIds);
  if (courses.length === 0) redirect("/student/courses");

  // Checkout always buys for the selected profile. Say so when that is a kid,
  // so a parent never pays for the wrong person.
  const learner =
    account && session.userId !== account.userId
      ? await db.user.findUnique({ where: { id: session.userId }, select: { firstName: true } })
      : null;

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Review your selection, then choose how you want to pay.
      </p>
      {learner && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Enrolling for <strong>{learner.firstName}</strong>. To enroll someone else, switch profiles from the menu at the top.
        </p>
      )}
      <div className="mt-6">
        <CheckoutForm courses={courses} learnerId={session.userId} />
      </div>
    </div>
  );
}
