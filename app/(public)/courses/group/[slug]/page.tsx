import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getPublicCourseGroup } from "@/lib/courses/queries";
import { priceSuffix } from "@/lib/courses/format";
import Eyebrow from "@/components/homepage/Eyebrow";
import Reveal from "@/components/homepage/Reveal";
import GeoMotif from "@/components/homepage/GeoMotif";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const group = await getPublicCourseGroup(slug);
  if (!group) return { title: "Program Not Found" };
  return { title: `${group.groupName} — Al-Qur'an Academy` };
}

export default async function CourseGroupPage({ params }: Props) {
  const { slug } = await params;
  const group = await getPublicCourseGroup(slug);
  if (!group) notFound();

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative flex min-h-[52vh] items-center overflow-hidden bg-black pt-28 pb-20">
        <div className="absolute inset-0 bg-[linear-gradient(140deg,#0b0b0f_0%,#070709_45%,#000000_100%)]" />
        <div className="absolute -top-40 -right-24 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(236,204,105,0.12),transparent_65%)]" />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(236,204,105,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(236,204,105,0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <GeoMotif className="-top-20 -right-20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_20%_50%,transparent_40%,rgba(0,0,0,0.6)_100%)]" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 sm:px-10 lg:px-16">
          <div className="animate-[fadeUp_0.9s_0.1s_both]">
            <Eyebrow>Multi-Level Program</Eyebrow>
          </div>
          <h1 className="mt-6 animate-[fadeUp_0.9s_0.2s_both] text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {group.groupName}
          </h1>
          <p className="mt-5 max-w-xl animate-[fadeUp_0.9s_0.32s_both] text-sm leading-relaxed font-light text-white/70">
            Progress through {group.levels.length}{" "}
            {group.levels.length === 1 ? "level" : "levels"} — choose the level
            that fits where you are in your journey.
          </p>
        </div>
      </section>

      {/* ── Levels ── */}
      <section className="bg-[#f4f7fa]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12">
            <Eyebrow className="mb-3">The Levels</Eyebrow>
            <h2 className="text-primary text-3xl font-semibold tracking-tight sm:text-4xl">
              {group.groupName} Levels
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {group.levels.map((course, i) => (
              <Reveal key={course.id} delay={(i % 3) * 80}>
                <div className="group ring-primary/10 flex h-full flex-col overflow-hidden bg-white shadow-md ring-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                  {/* Top — image */}
                  <div className="relative h-72 shrink-0">
                    {course.imageUrl && /^https?:\/\//.test(course.imageUrl) ? (
                      <img
                        src={course.imageUrl}
                        alt={course.title}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="bg-primary absolute inset-0 flex items-center justify-center">
                        <span className="text-gold text-5xl font-semibold">
                          {course.title.charAt(0)}
                        </span>
                      </div>
                    )}
                    {course.level != null && (
                      <span className="bg-gold text-primary absolute top-3 left-3 px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] uppercase">
                        Level {course.level}
                      </span>
                    )}
                    <span className="bg-gold absolute inset-x-0 bottom-0 z-10 h-0.5 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />
                  </div>

                  {/* Bottom — content */}
                  <div className="flex flex-1 flex-col justify-between p-6">
                    <div>
                      <h3 className="text-primary text-base font-semibold">
                        {course.title}
                      </h3>
                      {course.description && (
                        <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-relaxed font-light">
                          {course.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-6">
                      {course.tuitionFee != null ? (
                        <div>
                          <span className="text-primary text-xl font-bold">
                            ₱{course.tuitionFee.toLocaleString("en-PH")}
                          </span>
                          {course.paymentFrequency && (
                            <span className="text-muted-foreground ml-1 text-sm">
                              {priceSuffix(course.paymentFrequency)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          Contact us for pricing
                        </p>
                      )}
                      <div className="mt-5">
                        <Link
                          href={`/courses/${course.id}`}
                          className="border-primary/30 text-primary hover:border-primary hover:bg-primary inline-flex w-full items-center justify-center border px-6 py-2.5 text-[11px] font-bold tracking-[0.15em] uppercase transition-colors hover:text-white"
                        >
                          Learn More
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-12">
            <Link
              href="/courses"
              className="text-primary/70 hover:text-primary inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              Back to all courses
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
