import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Reveal from "./Reveal";
import FacultyCarousel from "./FacultyCarousel";

/**
 * Media that fills the card width and is clipped by the card's bottom edge.
 * The source PNGs carry their own transparent margins, which supplies the
 * visual inset.
 */
function CardImage({
  src,
  alt,
  offset = 0,
}: {
  src: string;
  alt: string;
  /** Pixels to pull the image up by, framing its subject in the window. */
  offset?: number;
}) {
  return (
    <div className="h-full overflow-hidden">
      <Image
        src={src}
        alt={alt}
        width={831}
        height={1024}
        sizes="(max-width: 768px) 100vw, 400px"
        className="h-auto w-full"
        style={{ marginTop: `-${offset}px` }}
      />
    </div>
  );
}

const CARDS = [
  {
    title: "Qualified & Trusted Educators",
    body: "Learn from credible teachers with formal Islamic education, extensive teaching experience, and professional academic backgrounds.",
    media: <FacultyCarousel />,
    /** The carousel tiles keep their own inset from the card edges. */
    pad: "px-5",
    cta: "Meet Faculty",
    href: "/courses",
  },
  {
    title: "Arabic at the Heart of Our Curriculum",
    body: "A proven, structured approach to learning Arabic, led by a specialist in teaching Arabic to non-native speakers and strengthened by native Arabic speakers.",
    media: (
      <CardImage
        src="/home/core/arabic-curriculum.png"
        alt="Saudi Ministry Arabic curriculum textbooks used at AQA"
      />
    ),
    pad: "",
    cta: "View Curriculum",
    href: "/courses",
  },
  {
    title: "Saudi Ministry Curriculum & Resources",
    body: "AQA incorporates Saudi Ministry-based learning materials for research-based, reliable, and progressive learning experience.",
    media: (
      <CardImage
        src="/home/core/saudi-resources.png"
        alt="AQA lessons delivered on a tablet"
        offset={110}
      />
    ),
    pad: "",
    cta: "View Resources",
    href: "/courses",
  },
];

export default function EducationalCore() {
  return (
    <section id="core" className="bg-brand-maroon px-6 pt-16 pb-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <h2 className="text-3xl font-bold sm:text-5xl">
            <span className="text-white">AQA </span>
            <span className="text-brand-gold">Educational</span>
            <span className="text-white"> Core</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/90">
            The core elements that define AQA&apos;s approach to structured and
            authentic Islamic education.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {CARDS.map((card, i) => (
            <Reveal key={card.title} delay={i * 90}>
              <div className="group flex h-full flex-col">
                <div className="flex flex-1 flex-col overflow-hidden rounded-[20px] bg-[#f7f7f7]">
                  <div className="p-7 pb-5">
                    <h3 className="text-brand-maroon-dark text-2xl leading-snug font-medium">
                      {card.title}
                    </h3>
                    <p className="text-brand-ink mt-4 text-base leading-relaxed">
                      {card.body}
                    </p>
                  </div>
                  <div className={`mt-auto h-[250px] ${card.pad}`}>
                    {card.media}
                  </div>
                </div>

                {/* Revealed on hover, on keyboard focus, and always below md
                    where there is no hover to trigger it. The row is always
                    laid out, so revealing it shifts nothing. */}
                <div className="mt-5 flex h-12 items-center justify-center">
                  <Link
                    href={card.href}
                    className="bg-brand-maroon-deep hover:bg-brand-maroon-dark pointer-events-none inline-flex scale-[0.8] items-center gap-2 rounded-full px-6 py-3 text-base font-medium text-white opacity-0 transition-all duration-300 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 max-md:pointer-events-auto max-md:scale-100 max-md:opacity-100 motion-reduce:transition-none"
                  >
                    {card.cta} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
