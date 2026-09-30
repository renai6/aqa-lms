import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import SiteHeader from "@/components/homepage/SiteHeader";
import SiteFooter from "@/components/homepage/SiteFooter";
import Eyebrow from "@/components/homepage/Eyebrow";
import Reveal from "@/components/homepage/Reveal";
import { FAQ_CATEGORIES, faqJsonLd } from "@/lib/faq/content";
import { FACEBOOK_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ | Al-Qur'an Academy",
  description:
    "Answers to common questions about Al-Qur'an Academy: creating an account, enrolling, payments, live classes, quizzes and certificates.",
};

export default function FaqPage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Maroon band, matching the Faculty page. The top padding clears the
            fixed 60px header. */}
        <section className="bg-brand-maroon px-6 pt-32 pb-20 text-center">
          <Reveal className="mx-auto max-w-3xl">
            <Eyebrow center>Help Center</Eyebrow>
            <h1 className="mt-5 text-3xl font-bold sm:text-5xl">
              <span className="text-white">Frequently Asked </span>
              <span className="text-brand-gold">Questions</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/90">
              Quick answers about enrolling, paying, attending classes and
              earning your certificate.
            </p>
          </Reveal>
        </section>

        <section className="bg-white px-6 pt-12 pb-24">
          <div className="mx-auto max-w-3xl">
            <nav
              aria-label="FAQ topics"
              className="flex flex-wrap justify-center gap-2 md:-mx-10"
            >
              {FAQ_CATEGORIES.map((category) => (
                <a
                  key={category.id}
                  href={`#${category.id}`}
                  className="border-brand-maroon/20 text-brand-maroon hover:bg-brand-maroon rounded-full border px-4 py-1.5 text-xs font-medium transition-colors hover:text-white"
                >
                  {category.title}
                </a>
              ))}
            </nav>

            {FAQ_CATEGORIES.map((category) => (
              // scroll-mt keeps the heading clear of the fixed header when a
              // topic link jumps here.
              <section
                key={category.id}
                id={category.id}
                aria-labelledby={`${category.id}-title`}
                className="mt-14 scroll-mt-24"
              >
                <h2
                  id={`${category.id}-title`}
                  className="text-brand-maroon text-xl font-bold sm:text-2xl"
                >
                  {category.title}
                </h2>
                <div className="divide-brand-ink/10 border-brand-ink/10 mt-4 divide-y border-y">
                  {category.items.map((item) => (
                    <details key={item.question} className="group">
                      <summary className="text-brand-ink hover:text-brand-maroon flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15px] font-medium transition-colors [&::-webkit-details-marker]:hidden">
                        {item.question}
                        <ChevronDown
                          aria-hidden="true"
                          className="text-brand-maroon h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
                        />
                      </summary>
                      <div className="text-brand-ink/80 space-y-3 pr-8 pb-6 text-sm leading-relaxed">
                        {item.answer.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))}

            <div className="bg-brand-peach mt-20 rounded-3xl px-6 py-12 text-center sm:px-8">
              <h2 className="text-brand-maroon text-2xl font-bold">
                Still have questions?
              </h2>
              <p className="text-brand-ink/80 mx-auto mt-3 max-w-md text-sm leading-relaxed">
                Message our Facebook page and the academy team will help you
                out.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <a
                  href={FACEBOOK_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="bg-brand-facebook inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Message us on Facebook
                </a>
                <Link
                  href="/courses"
                  className="bg-brand-maroon hover:bg-brand-maroon-mid inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-medium text-white transition-colors"
                >
                  Browse Programs <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/register"
                  className="border-brand-maroon/30 text-brand-maroon hover:bg-brand-maroon inline-flex items-center rounded-full border bg-white px-7 py-3.5 text-sm font-medium transition-colors hover:text-white"
                >
                  Create an account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />

      {/* Escaping "<" stops an answer from closing the script tag early. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd()).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
