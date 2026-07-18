import { redirect } from "next/navigation";
import Image from "next/image";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getCertificateEligibility } from "@/lib/certificates/queries";
import { issueCertificate } from "@/lib/certificates/issue";
import { PrintButton } from "./print-button";

export const metadata = { title: "Certificate - AQA Student" };

type Props = { params: Promise<{ courseId: string }> };

export default async function CertificatePage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { courseId } = await params;

  // Ownership: the student must be enrolled in this course.
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: session.userId, courseId } },
    select: { id: true },
  });
  if (!enrollment) redirect("/student/dashboard");

  // Recompute eligibility server-side; never trust the client.
  const result = await getCertificateEligibility(session.userId, courseId);
  if (!result || !result.eligibility.eligible) redirect("/student/dashboard");

  const [cert, user] = await Promise.all([
    issueCertificate(session.userId, courseId),
    db.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true, displayName: true },
    }),
  ]);

  const studentName =
    (user && `${user.firstName} ${user.lastName}`.trim()) ||
    user?.displayName ||
    "Student";
  const average = Math.round(result.eligibility.courseGrade as number);
  const issuedOn = cert.issuedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-zinc-100 px-4 py-10">
      {/* Certificate sheet */}
      <div
        id="certificate"
        className="relative aspect-[297/210] w-full max-w-[1000px] overflow-hidden bg-white shadow-lg"
      >
        {/* Border frame */}
        <div className="border-primary/70 absolute inset-4 border-2" />
        <div className="border-primary/30 absolute inset-6 border" />

        <div className="relative flex h-full flex-col items-center justify-center px-16 py-12 text-center">
          <Image
            src="/aqa-logo.png"
            alt="Al-Qur'an Academy"
            width={72}
            height={72}
            className="mb-4"
          />
          <p className="text-primary text-[11px] font-semibold tracking-[0.35em] uppercase">
            Al-Qur&apos;an Academy
          </p>

          <h1 className="font-heading mt-6 text-3xl font-bold tracking-tight text-zinc-900">
            Certificate of Completion
          </h1>

          <p className="mt-6 text-sm text-zinc-500">This certifies that</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {studentName}
          </p>

          <p className="mt-4 max-w-xl text-sm text-zinc-600">
            has successfully completed{" "}
            <span className="font-semibold text-zinc-900">
              {result.courseTitle}
            </span>{" "}
            with a final average of{" "}
            <span className="text-primary font-semibold">{average}%</span>.
          </p>

          <div className="mt-10 flex w-full max-w-xl items-end justify-between text-left">
            <div>
              <p className="text-[10px] tracking-[0.2em] text-zinc-400 uppercase">
                Certificate No.
              </p>
              <p className="text-sm font-medium text-zinc-700">
                {cert.certificateNo}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] tracking-[0.2em] text-zinc-400 uppercase">
                Issued
              </p>
              <p className="text-sm font-medium text-zinc-700">{issuedOn}</p>
            </div>
          </div>
        </div>
      </div>

      <PrintButton />
    </div>
  );
}
