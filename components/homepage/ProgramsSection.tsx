import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, SignalHigh } from "lucide-react";
import Reveal from "./Reveal";

type Program = {
  audience: "adults" | "kids";
  mode: "ONLINE" | "ONSITE";
  schedule: string;
  age: string;
  blurb: string;
  photos: string[];
  /** Card tilt in degrees. */
  rotate: number;
};

const PROGRAMS: Program[] = [
  {
    audience: "adults",
    mode: "ONLINE",
    schedule: "Weekday Nights & Weekends",
    age: "Age 15 and above",
    blurb:
      "A flexible learning pathway for adults through level-based Islamic Education, Qur'an programs, and short arabic courses.",
    photos: [
      "/home/programs/adult-online-1.png",
      "/home/programs/adult-online-2.png",
      "/home/programs/adult-online-3.png",
      "/home/programs/adult-online-4.jpeg",
    ],
    rotate: -3,
  },
  {
    audience: "kids",
    mode: "ONLINE",
    schedule: "Friday Night & Weekends",
    age: "Age 5 to 14",
    blurb:
      "Age-appropriate Islamic learning for kids from Kinder to Grade 6 and dedicated Qur'an classes for them.",
    photos: [
      "/home/programs/kids-online-1.png",
      "/home/programs/kids-online-2.png",
      "/home/programs/kids-online-3.png",
      "/home/programs/kids-online-4.png",
    ],
    rotate: 3,
  },
  {
    audience: "adults",
    mode: "ONSITE",
    schedule: "Every Saturday & Sunday",
    age: "Age 15 and above",
    blurb:
      "For Zamboanga-based women, courses include level-based Islamic Education, Qur'an classes, and short Arabic courses, all taught by female teachers.",
    photos: [
      "/home/programs/adult-onsite-1.jpg",
      "/home/programs/adult-onsite-2.jpg",
      "/home/programs/adult-onsite-3.jpg",
      "/home/programs/adult-onsite-4.jpg",
    ],
    rotate: -3,
  },
  {
    audience: "kids",
    mode: "ONSITE",
    schedule: "Every Saturday & Sunday",
    age: "Age 5 to 14",
    blurb:
      "For Zamboanga-based kids, face-to-face classes include Qur'an and short Arabic programs.",
    photos: [
      "/home/programs/kids-onsite-1.jpeg",
      "/home/programs/kids-onsite-2.jpg",
      "/home/programs/kids-onsite-3.jpg",
      "/home/programs/kids-onsite-4.jpeg",
    ],
    rotate: 3,
  },
];

/**
 * Per-photo tilt and the offset each one fans out to while the card is
 * hovered. Written as literal class strings so Tailwind can see them.
 */
const STACK = [
  { rotate: "-14deg", fan: "" },
  {
    rotate: "9deg",
    fan: "group-hover:translate-x-[14px] group-hover:-translate-y-[14px]",
  },
  {
    rotate: "-12deg",
    fan: "group-hover:translate-x-[24px] group-hover:-translate-y-[30px]",
  },
  {
    rotate: "11deg",
    fan: "group-hover:translate-x-[38px] group-hover:-translate-y-[46px]",
  },
];

function PhotoStack({ photos, alt }: { photos: string[]; alt: string }) {
  return (
    <div className="flex items-center justify-center -space-x-3">
      {photos.map((src, i) => (
        <div
          key={src}
          className={[
            "relative w-[80px] shrink-0 overflow-hidden rounded-[8px] bg-white p-1 shadow-[0_6px_18px_rgba(0,0,0,0.18)] sm:w-[100px]",
            "transition-transform duration-500 ease-out motion-reduce:transition-none",
            STACK[i].fan,
          ].join(" ")}
          style={{ rotate: STACK[i].rotate }}
        >
          <div className="relative aspect-[4/5] overflow-hidden rounded-[5px]">
            <Image
              src={src}
              alt={i === 0 ? alt : ""}
              fill
              sizes="120px"
              className="object-cover"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgramCard({ program }: { program: Program }) {
  const isOnline = program.mode === "ONLINE";
  const isKids = program.audience === "kids";

  return (
    <div
      className={[
        "group flex flex-col gap-6 rounded-[20px] p-7 shadow-[0_14px_40px_rgba(0,0,0,0.22)] sm:p-9",
        // The card washes out to white while hovered, as the reference does.
        // `group-hover:` targets descendants, so the card itself uses `hover:`.
        "transition-colors duration-300 hover:bg-white",
        isOnline ? "bg-brand-cream" : "bg-brand-peach",
      ].join(" ")}
      style={{ rotate: `${program.rotate}deg` }}
    >
      <div>
        {/* The arrow is centred against the title, with the badge beneath. */}
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-brand-maroon-dark text-3xl leading-tight font-semibold sm:text-[2.5rem]">
            {isKids ? (
              <>
                For{" "}
                <span
                  className={[
                    "font-chunky",
                    isOnline ? "text-brand-orange" : "text-brand-pink",
                  ].join(" ")}
                >
                  KIDS
                </span>
                <br />
                Classes
              </>
            ) : (
              <>
                For Adult
                <br />
                Learners
              </>
            )}
          </h3>
          {/* Arrow carries the mode colour, and goes maroon while hovered. */}
          <ArrowRight
            className={[
              "group-hover:text-brand-maroon h-10 w-10 shrink-0 transition-colors duration-300",
              isOnline ? "text-brand-green" : "text-brand-amber",
            ].join(" ")}
          />
        </div>

        <span
          className={[
            "mt-3 inline-block rounded-[8px] px-3 py-1 text-lg font-semibold text-white sm:text-[22px]",
            isOnline ? "bg-brand-green" : "bg-brand-amber",
          ].join(" ")}
        >
          {program.mode}
        </span>
      </div>

      <PhotoStack
        photos={program.photos}
        alt={`${isKids ? "Kids" : "Adult"} ${program.mode.toLowerCase()} classes at AQA`}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="text-brand-maroon flex items-center gap-1.5 text-xs font-medium">
          <Clock className="h-3.5 w-3.5" />
          {program.schedule}
        </span>
        <span className="text-brand-maroon flex items-center gap-1.5 text-xs font-medium">
          <SignalHigh className="h-3.5 w-3.5" />
          {program.age}
        </span>
      </div>

      <p className="text-brand-ink text-[15px] leading-relaxed font-medium sm:text-base">
        {program.blurb}
      </p>
    </div>
  );
}

export default function ProgramsSection() {
  return (
    <section id="programs" className="bg-brand-maroon px-6 pt-24 pb-20">
      <div className="mx-auto max-w-5xl">
        <Reveal className="text-center">
          <h2 className="text-3xl leading-tight font-bold sm:text-5xl">
            <span className="text-brand-gold">Structured Islamic Courses</span>
            <br />
            <span className="text-white">Made Clear and Convenient</span>
          </h2>
        </Reveal>

        <Reveal className="mx-auto mt-14 flex max-w-[700px] flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-12">
          <p className="text-4xl font-bold whitespace-nowrap text-white sm:text-5xl">
            3,536<span className="text-brand-gold">+</span>
          </p>
          <p className="max-w-xl text-base leading-relaxed text-white sm:text-[17px]">
            AQA students across the Philippines and abroad pursuing Islamic
            Education as part of their everyday lives while managing their
            secular studies, working, and raising families.
          </p>
        </Reveal>

        <div className="mt-20 grid grid-cols-1 gap-10 sm:gap-14 lg:grid-cols-2 lg:gap-x-16 lg:gap-y-20">
          {PROGRAMS.map((program, i) => (
            <Reveal key={`${program.audience}-${program.mode}`} delay={i * 80}>
              <ProgramCard program={program} />
            </Reveal>
          ))}
        </div>

        <div className="mt-24 flex justify-center">
          <Link
            href="/courses"
            className="hover:text-brand-maroon rounded-full border border-white px-8 py-3.5 text-base text-white transition-colors hover:bg-white"
          >
            View All Programs
          </Link>
        </div>
      </div>
    </section>
  );
}
