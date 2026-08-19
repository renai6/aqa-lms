import Link from "next/link";
import Reveal from "./Reveal";

export default function CertificatesSection() {
  return (
    <section className="bg-white px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <h2 className="text-brand-maroon max-w-[920px] text-3xl leading-snug font-medium sm:text-[41px]">
            AQA provides completion certificates and diplomas along with
            achievement prizes, but the heart of the journey remains seeking
            knowledge to know Allah better, worship Him correctly, act upon what
            we learn, and become a source of goodness for others.
          </h2>
        </Reveal>

        <Reveal className="mt-16 max-w-2xl">
          <p className="text-brand-ink text-base leading-relaxed sm:text-lg">
            The Ummah is not strengthened by a single great effort, but by
            countless Muslims who sincerely learn, practice what they learn, and
            patiently pass that knowledge on. By supporting AQA&apos;s efforts
            to sustain Islamic knowledge,{" "}
            <strong className="text-brand-maroon font-bold">
              you can also have a share in this reward and help this learning
              continue to benefit future generations
            </strong>
            .
          </p>

          <div className="mt-8">
            <Link
              href="/courses"
              className="bg-brand-amber-soft hover:bg-brand-amber inline-block rounded-full px-8 py-3.5 text-lg font-medium text-white transition-colors sm:text-xl"
            >
              Take Part in the Reward
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
