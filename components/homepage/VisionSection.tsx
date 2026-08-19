import Link from "next/link";
import PhotoStrip from "./PhotoStrip";
import Reveal from "./Reveal";

export default function VisionSection() {
  return (
    <section className="bg-white px-6 pt-10 pb-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <PhotoStrip />
        </Reveal>

        <Reveal className="mx-auto mt-20 max-w-3xl text-center">
          <h2 className="text-brand-maroon text-2xl leading-snug font-bold sm:text-3xl">
            Our Long-Term Vision of Building an{" "}
            <span className="text-brand-crimson">
              Integrated Islamic Educational Institution
            </span>{" "}
            for Future Muslim Generations
          </h2>

          <p className="text-brand-ink mt-8 text-base leading-relaxed sm:text-[17px]">
            The{" "}
            <strong className="text-brand-crimson font-bold">
              establishment of our Nursery Program
            </strong>{" "}
            marks the beginning of an integrated Islamic educational institution
            which successfully blends academic and Islamic education in its
            curriculum. We envision raising a generation of Muslim professionals
            who are not only competitive in their own academic fields but also
            possess the authentic understanding of the Qur&apos;an and Sunnah in
            its original text.
          </p>

          <div className="mt-10 flex justify-center">
            <Link
              href="/courses"
              className="bg-brand-maroon hover:bg-brand-maroon-mid rounded-full px-8 py-4 text-xl font-medium text-white transition-colors"
            >
              Take the Next Step
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
