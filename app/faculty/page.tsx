import type { Metadata } from "next";
import SiteHeader from "@/components/homepage/SiteHeader";
import SiteFooter from "@/components/homepage/SiteFooter";
import BeforeFooter from "@/components/homepage/BeforeFooter";
import Eyebrow from "@/components/homepage/Eyebrow";
import Reveal from "@/components/homepage/Reveal";
import FacultyPosters from "@/components/faculty/FacultyPosters";

export const metadata: Metadata = {
  title: "Faculty | Al-Qur'an Academy",
  description:
    "Meet the AQA faculty: credentialed shuyukh and ustadhat with formal Islamic education from the Islamic University of Madinah, King Saud University and beyond.",
};

export default function FacultyPage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Maroon band, matching the Educational Core section on the homepage.
            The top padding clears the fixed 60px header. */}
        <section className="bg-brand-maroon px-6 pt-32 pb-20 text-center">
          <Reveal className="mx-auto max-w-3xl">
            <Eyebrow center>Our Instructors</Eyebrow>
            <h1 className="mt-5 text-3xl font-bold sm:text-5xl">
              <span className="text-white">Meet the </span>
              <span className="text-brand-gold">AQA</span>
              <span className="text-white"> Faculty</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/90">
              Credible teachers with formal Islamic education, extensive
              teaching experience, and professional academic backgrounds.
            </p>
          </Reveal>
        </section>

        <section className="bg-white px-6 pt-16 pb-24">
          <div className="mx-auto max-w-6xl">
            <FacultyPosters />
          </div>
        </section>

        <BeforeFooter />
      </main>
      <SiteFooter />
    </>
  );
}
