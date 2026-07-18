// app/(student)/student/courses/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Award, Lock, Video } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getStudentCourse } from "@/lib/student/queries";
import { getCertificateEligibility } from "@/lib/certificates/queries";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CertificateCard } from "@/components/certificate/certificate-card";

type Props = { params: Promise<{ id: string }> };

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${mStr} ${period}`;
}

const DAY_LABEL: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

function gradeBadgeClass(score: number): string {
  if (score >= 75) return "bg-emerald-100 text-emerald-700";
  if (score >= 50) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export function generateMetadata() {
  return { title: "Course — AQA Student" };
}

export default async function StudentCoursePage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const [course, cert, user] = await Promise.all([
    getStudentCourse(session.userId, id),
    getCertificateEligibility(session.userId, id),
    db.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true, displayName: true },
    }),
  ]);
  if (!course) notFound();

  const pct =
    course.totalLessons > 0
      ? Math.round((course.completedLessons / course.totalLessons) * 100)
      : 0;

  const studentName =
    (user && `${user.firstName} ${user.lastName}`.trim()) ||
    user?.displayName ||
    "Student";

  // Certificate is offered only for a course that has certifiable subjects.
  const eligibility =
    cert && cert.eligibility.totalSubjects > 0 ? cert.eligibility : null;
  const certAverage = Math.round(eligibility?.courseGrade ?? 0);
  const certReason = eligibility
    ? !eligibility.allGraded
      ? `Available once all ${eligibility.totalSubjects} subjects are graded (${eligibility.gradedCount}/${eligibility.totalSubjects} done)`
      : (eligibility.courseGrade ?? 0) < eligibility.passingGrade
        ? `Your average (${certAverage}%) is below the ${eligibility.passingGrade}% required to pass`
        : "Complete your full payment to unlock your certificate"
    : "";

  return (
    <div className="px-6 md:px-10 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/student/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Dashboard
        </Link>
        {course.imageUrl && (
          <div className="relative h-40 w-full overflow-hidden rounded-xl">
            <Image
              src={course.imageUrl}
              alt={course.title}
              fill
              className="object-cover"
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">{course.title}</h1>
          {course.meetLink && (
            <a
              href={course.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 shrink-0 text-sm font-medium text-primary hover:underline"
            >
              <Video className="w-4 h-4" aria-hidden="true" />
              Join Google Meet
            </a>
          )}
        </div>
      </div>

      {/* Overall progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall Progress</span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: pct + "%" }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {course.completedLessons} of {course.totalLessons} lessons completed
        </p>
      </div>

      {/* Certificate */}
      {eligibility && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Certificate
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 border rounded-lg p-5">
            {/* Mini preview */}
            <div className="relative w-full max-w-[380px] shrink-0 overflow-hidden rounded-lg border border-zinc-200 shadow-sm">
              <div
                className={
                  eligibility.eligible
                    ? ""
                    : "blur-[3px] opacity-50 select-none pointer-events-none"
                }
              >
                <CertificateCard
                  studentName={studentName}
                  courseTitle={course.title}
                  average={certAverage}
                />
              </div>
              {!eligibility.eligible && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/30">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/70 text-white">
                    <Lock className="w-4 h-4" aria-hidden="true" />
                  </span>
                </div>
              )}
            </div>

            {/* Status + action */}
            <div className="flex-1 space-y-2">
              {eligibility.eligible ? (
                <>
                  <p className="text-sm font-semibold text-emerald-700">
                    You passed with a {certAverage}% average.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your certificate of completion is ready to download.
                  </p>
                  <Button asChild size="sm" className="mt-1">
                    <Link href={"/student/certificate/" + id}>
                      <Award className="w-4 h-4" aria-hidden="true" />
                      Download Certificate
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Certificate locked</p>
                  <p className="text-xs text-muted-foreground">{certReason}</p>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Subjects */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Subjects
        </h2>
        {course.subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No subjects available yet.
          </p>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden">
            {course.subjects.map((subject) => {
              const subPct =
                subject.totalLessons > 0
                  ? Math.round(
                      (subject.completedLessons / subject.totalLessons) * 100,
                    )
                  : 0;
              return (
                <Link
                  key={subject.id}
                  href={"/student/courses/" + id + "/subjects/" + subject.id}
                  className="flex items-center justify-between px-4 py-4 hover:bg-muted/50 transition-colors group"
                >
                  <div className="space-y-2 flex-1 min-w-0 pr-4">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">
                      {subject.title}
                    </p>
                    {subject.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {subject.description}
                      </p>
                    )}
                    {subject.schedules.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {subject.schedules.map((s, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-zinc-50 border border-zinc-200 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600"
                          >
                            {DAY_LABEL[s.day]} {formatTime(s.startTime)}–
                            {formatTime(s.endTime)}
                          </span>
                        ))}
                      </div>
                    )}
                    {subject.teachers.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-zinc-700">
                          Teacher:
                        </span>{" "}
                        {subject.teachers
                          .map((t) => t.firstName + " " + t.lastName)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 w-32 space-y-3 text-right">
                    {subject.totalAssessments > 0 && (
                      <div className="space-y-1">
                        {subject.averageScore != null ? (
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold " +
                              gradeBadgeClass(subject.averageScore)
                            }
                          >
                            {Math.round(subject.averageScore)}% grade
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            Not graded yet
                          </span>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          graded {subject.gradedAssessments} /{" "}
                          {subject.totalAssessments}
                        </p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: subPct + "%" }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {subject.completedLessons} / {subject.totalLessons}{" "}
                        lessons
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
