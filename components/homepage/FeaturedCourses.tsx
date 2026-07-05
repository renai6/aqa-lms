import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Eyebrow from "./Eyebrow";
import Reveal from "./Reveal";

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

const INCLUDED = [
  "Al-Qur'an Recitation & Memorization",
  "Islamic Studies (Fiqh, Aqeedah, Seerah)",
  "Arabic Language (Grammar & Composition)",
  "Saudi Ministry-aligned curriculum materials",
  "Live online classes with certified teachers",
];

export default function FeaturedCourses() {
  return (
    <>
      {/* ── Programs band (light) ── */}
      <section className="bg-[#f4f7fa] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          {/* Vision statement */}
          <Reveal className="mx-auto max-w-3xl text-center">
            <Eyebrow center className="mb-6">
              Our Institution
            </Eyebrow>
            <p className="text-lg leading-relaxed font-light text-zinc-700 sm:text-xl">
              Al-Qur&apos;an Academy (AQA) International envisions itself to
              becoming the{" "}
              <strong className="text-primary font-semibold">
                educational institution of choice of non-Arabic speaking Muslims
                for Arabic language and authentic Islamic education with a
                standard curriculum
              </strong>{" "}
              that is able to produce highly competent and globally productive
              Muslims.
            </p>
          </Reveal>

          {/* Section label */}
          <Reveal className="mt-20 mb-10 text-center">
            <Eyebrow center className="mb-3">
              Our Programs
            </Eyebrow>
            <h2 className="text-primary text-3xl font-semibold tracking-tight sm:text-4xl">
              Join Our Next Enrollment
            </h2>
          </Reveal>

          {/* ── Featured course ── */}
          <Reveal className="ring-primary/10 grid grid-cols-1 overflow-hidden shadow-2xl ring-1 lg:grid-cols-2">
            {/* Image */}
            <div className="relative h-56 sm:h-72 lg:h-auto lg:min-h-0">
              <Image
                src="/feature/MUTAWASSIT_Feat.png"
                alt="Marhalah Mutawassitah Program"
                fill
                className="object-cover object-left"
              />
            </div>

            {/* Info card */}
            <div className="bg-primary relative flex flex-col justify-center space-y-6 overflow-hidden p-8 lg:p-12">
              <span className="pointer-events-none absolute -top-6 right-4 text-[130px] leading-none font-bold text-white/[0.04] select-none">
                01
              </span>
              <div className="relative space-y-2">
                <p className="text-gold text-[10px] font-bold tracking-[0.28em] uppercase">
                  Featured Program
                </p>
                <h3 className="text-2xl leading-tight font-semibold text-white sm:text-3xl">
                  Marhalah Mutawassitah Program
                </h3>
                <p className="text-sm font-medium text-white/50">
                  Middle School · Three-year online program (Level 1–6)
                </p>
              </div>

              <p className="relative text-sm leading-relaxed font-light text-white/65">
                A structured three-year Islamic education program based on the
                Saudi Ministry curriculum, designed for students progressing
                through the middle school levels. Delivered fully online with
                live sessions and guided materials.
              </p>

              <div className="border-gold/15 relative space-y-3 border-t pt-2">
                <p className="pt-4 text-[10px] font-bold tracking-[0.22em] text-white/40 uppercase">
                  What&apos;s Included
                </p>
                <ul className="space-y-2 text-sm text-white/75">
                  {INCLUDED.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="text-gold mt-1.5 leading-none">—</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/courses"
                className="bg-gold text-primary hover:bg-gold-soft relative inline-flex items-center gap-2 self-start px-6 py-3 text-[11px] font-bold tracking-[0.18em] uppercase transition-all hover:gap-3"
              >
                Learn More <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          {/* ── Other courses ── */}
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {OTHER_COURSES.map((course, i) => (
              <Reveal key={course.image} delay={i * 80}>
                <Link
                  href={course.href}
                  className="group ring-primary/10 relative block aspect-[3/4] overflow-hidden shadow-md ring-1 transition-shadow duration-300 hover:shadow-2xl"
                >
                  <Image
                    src={course.image}
                    alt={course.alt}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <span className="bg-gold absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />
                </Link>
              </Reveal>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              href="/courses"
              className="border-primary/25 text-primary hover:border-primary hover:bg-primary inline-flex items-center gap-2 border px-7 py-3 text-[11px] font-bold tracking-[0.18em] uppercase transition-colors hover:text-white"
            >
              Discover More <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Faculty band (dark) ── */}
      <section className="bg-primary relative overflow-hidden px-6 py-24">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(236,204,105,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(236,204,105,0.04) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
        <div className="relative mx-auto max-w-5xl text-center">
          <Reveal>
            <Eyebrow center className="mb-5">
              AQA Faculty Board
            </Eyebrow>
            <h2 className="mx-auto max-w-3xl text-2xl leading-snug font-semibold text-white sm:text-3xl">
              Our qualified faculty of men &amp; women offers the{" "}
              <span className="text-gold">best of both worlds.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed font-light text-white/55">
              From graduates of foreign Islamic universities to successful
              professionals of various fields, all uniquely equipped with
              up-to-date teaching methods and expertise to cater all kinds of
              learners.
            </p>
          </Reveal>

          <Reveal className="mt-12 flex flex-wrap items-center justify-center gap-4">
            {FACULTY.map((name) => (
              <div
                key={name}
                className="ring-gold/25 hover:ring-gold h-16 w-16 overflow-hidden rounded-full bg-gradient-to-t from-[#f5a561] to-[#fab46e] ring-1 transition-all duration-300 hover:-translate-y-1 sm:h-20 sm:w-20"
                aria-label={name}
              >
                <img
                  src={`/faculty/${encodeURIComponent(name)}`}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </Reveal>
        </div>
      </section>
    </>
  );
}
