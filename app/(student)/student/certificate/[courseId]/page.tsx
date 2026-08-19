import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isActiveStudent } from "@/lib/auth/capabilities";
import { db } from "@/lib/db";
import { getCertificateEligibility } from "@/lib/certificates/queries";
import { issueCertificate } from "@/lib/certificates/issue";
import { CertificateCard } from "@/components/certificate/certificate-card";
import { PrintButton } from "./print-button";

export const metadata = { title: "Certificate - AQA Student" };

type Props = { params: Promise<{ courseId: string }> };

export default async function CertificatePage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await isActiveStudent(session))) redirect("/login");

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
    <div className="bg-muted flex min-h-screen flex-col items-center gap-6 px-4 py-10">
      {/* Certificate sheet */}
      <div
        id="certificate"
        className="w-full max-w-[1000px] overflow-hidden shadow-lg"
      >
        <CertificateCard
          studentName={studentName}
          courseTitle={result.courseTitle}
          average={average}
          certificateNo={cert.certificateNo}
          issuedAt={issuedOn}
        />
      </div>

      <PrintButton />
    </div>
  );
}
