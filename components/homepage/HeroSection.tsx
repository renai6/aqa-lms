import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import HeroBackdrop from "./HeroBackdrop";

const FACEBOOK_URL = "https://www.facebook.com/AlQuranAcademyInternational";

/** Small circular photo that sits inline with the headline. */
function Bubble({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="relative mx-1.5 inline-block h-[0.8em] w-[0.8em] overflow-hidden rounded-full align-[-0.08em] ring-2 ring-white/70">
      <Image src={src} alt={alt} fill sizes="120px" className="object-cover" />
    </span>
  );
}

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-white">
      {/* Campus film, full bleed */}
      <HeroBackdrop />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pt-28 pb-32 text-center">
        <h1 className="font-display animate-[fadeUp_0.9s_0.1s_both] text-[1.9rem] leading-[1.2] tracking-tight text-white sm:text-5xl lg:text-[4.5rem]">
          Raising the Standard
          <br />
          of <span className="highlight-crimson">Islamic Education</span>
          <Bubble src="/home/hero-bubble-grad.png" alt="" />
          <br />
          for Muslim Filipinos
          <Bubble src="/home/hero-bubble-flags.png" alt="" />
        </h1>

        <p className="mx-auto mt-8 max-w-3xl animate-[fadeUp_0.9s_0.28s_both] text-base leading-relaxed text-white/90 sm:text-[17px]">
          <strong className="font-bold text-white">
            Al-Qur&apos;an Academy (AQA) International
          </strong>{" "}
          delivers high-quality, structured Islamic education guided by the
          Saudi Ministry curriculum for children and adults to study Islam
          properly through qualified educators and modern, research-based
          learning methodologies.
        </p>

        <div className="mt-10 flex animate-[fadeUp_0.9s_0.42s_both] flex-wrap items-center justify-center gap-4">
          <Link
            href="/courses"
            className="bg-brand-maroon hover:bg-brand-maroon-mid inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-medium text-white transition-colors"
          >
            Explore Programs <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-brand-facebook border-brand-facebook/60 hover:bg-brand-facebook inline-flex items-center gap-2 rounded-full border bg-white px-7 py-3.5 text-sm font-light transition-colors hover:text-white"
          >
            Visit Facebook Page
          </a>
        </div>
      </div>
    </section>
  );
}
