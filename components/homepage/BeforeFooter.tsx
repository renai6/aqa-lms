import Reveal from "./Reveal";

export default function BeforeFooter() {
  return (
    <section className="bg-white px-6 pb-28">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="font-script text-brand-quote text-2xl leading-snug sm:text-[35px]">
          &quot; If Muslims really desire to make a difference, then strive to
          attain both academics and Islamic knowledge.&quot;
        </p>
        <p className="font-script text-brand-ink mt-10 text-xl sm:text-2xl">
          Shaykh Vladimir Sahiron | AQA President
        </p>
      </Reveal>
    </section>
  );
}
