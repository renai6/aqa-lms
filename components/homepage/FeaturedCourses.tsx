import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const OTHER_COURSES = [
  {
    image: "/feature/FC-ECE.png",
    alt: "Early Childhood Education Program",
    href: "/courses",
  },
  {
    image: "/feature/FC-KIDS_PROGRAM.png",
    alt: "Kids Online Program",
    href: "/courses",
  },
  {
    image: "/feature/FC-QURAN.png",
    alt: "Qur'an Tahseen & Tahfidh",
    href: "/courses",
  },
];

const FACULTY = [
  "shaykh abu furqan.png",
  "shaykh abuhafs.png",
  "shaykh ahmad.png",
  "shaykh ahmed.png",
  "shaykh bash.png",
  "shaykh hafeyz.png",
  "shaykh jibrin.png",
  "shaykh nadhir.png",
  "shaykh raffy.png",
  "shaykh shater.png",
  "shaykh vlad.png",
  "shk alsam.png",
  "ustadha mozifa.png",
  "ustadha shaiwra.png",
];

export default function FeaturedCourses() {
  return (
    <section className="bg-background py-20 px-4">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Vision statement */}
        <p className="text-center text-sm sm:text-base text-zinc-600 leading-relaxed max-w-3xl mx-auto">
          Al-Qur&apos;an Academy (AQA) International envisions itself to
          becoming the{" "}
          <strong className="text-primary font-bold">
            educational institution of choice of non-Arabic speaking Muslims for
            Arabic language and authentic Islamic education with a standard
            curriculum
          </strong>{" "}
          that is able to produce highly competent and globally productive
          Muslims.
        </p>

        {/* Section label */}
        <div className="text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Our Programs
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            Join Our Next Enrollment
          </h2>
        </div>

        {/* ── Featured course ── */}
        <div className="mb-12 grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-2xl overflow-hidden shadow-xl border border-border">
          {/* Image */}
          <div className="relative h-56 sm:h-64 lg:h-auto lg:min-h-0 flex-[1.5]">
            <Image
              src="/feature/MUTAWASSIT_Feat.png"
              alt="Marhalah Mutawassitah Program"
              fill
              className="object-cover object-left"
            />
          </div>

          {/* Info card */}
          <div className="bg-white flex flex-col justify-center p-8 lg:p-10 space-y-6">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Featured Program
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-zinc-900 leading-tight">
                Marhalah Mutawassitah Program
              </h3>
              <p className="text-sm text-zinc-500 font-medium">
                Middle School · Three-year online program (Level 1–6)
              </p>
            </div>

            <p className="text-sm text-zinc-600 leading-relaxed">
              A structured three-year Islamic education program based on the
              Saudi Ministry curriculum, designed for students progressing
              through the middle school levels. Delivered fully online with live
              sessions and guided materials.
            </p>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                What&apos;s Included
              </p>
              <ul className="space-y-1.5 text-sm text-zinc-700">
                {[
                  "Al-Qur'an Recitation & Memorization",
                  "Islamic Studies (Fiqh, Aqeedah, Seerah)",
                  "Arabic Language (Grammar & Composition)",
                  "Saudi Ministry-aligned curriculum materials",
                  "Live online classes with certified teachers",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href="/courses"
              className="inline-flex items-center gap-2 self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Learn More <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* ── Other courses ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {OTHER_COURSES.map((course) => (
            <Link
              key={course.image}
              href={course.href}
              className="group relative aspect-[3/4] rounded-md overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300"
            >
              <Image
                src={course.image}
                alt={course.alt}
                fill
                className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
              />
            </Link>
          ))}
        </div>
        <div className="flex justify-center">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 self-start rounded-full bg-primary/80 px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Discover More <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="flex justify-center flex-col items-center mt-6">
          <p className="text-lg font-bold uppercase tracking-[0.2em] text-primary">
            Our qualified faculty of men & women offers the best of both worlds.
          </p>
          <p className="text-xs tracking-[0.2em] text-secondary-foreground/80 text-center mt-2 max-w-2xl">
            From graduates of foreign Islamic universities to successful
            professionals of various fields, all uniquely equipped with
            up-to-dale teaching methods and expertise to cater all kinds of
            learners.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 justify-center items-center">
            {FACULTY.map((name) => (
              <div
                key={name}
                className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 bg-white/5 flex items-center justify-center"
                aria-label={name}
              >
                <img
                  src={`/faculty/${encodeURIComponent(name)}`}
                  alt={name}
                  className="w-25 h-25 rounded-full"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
