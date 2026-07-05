import Eyebrow from "./Eyebrow";
import Reveal from "./Reveal";

export default function BeforeFooter() {
  return (
    <section className="relative overflow-hidden bg-[#521021] px-6 py-24">
      <span className="text-gold/15 pointer-events-none absolute top-8 left-1/2 -translate-x-1/2 text-[180px] leading-[0.5] select-none">
        &ldquo;
      </span>
      <Reveal className="relative mx-auto max-w-3xl text-center">
        <Eyebrow center className="mb-8">
          From Our President
        </Eyebrow>
        <p className="text-2xl leading-snug font-light tracking-tight text-white sm:text-3xl">
          If Muslims really desire to make a difference, then{" "}
          <span className="text-gold font-normal italic">
            strive to attain both academic and Islamic knowledge.
          </span>
        </p>
        <p className="text-gold mt-8 text-[11px] font-semibold tracking-[0.2em] uppercase">
          Sheikh Vladimir Sahiron
          <span className="font-light tracking-normal text-white/40 normal-case">
            {" "}
            — AQA President
          </span>
        </p>
      </Reveal>
    </section>
  );
}
