"use client";

import { useEffect, useRef, useState } from "react";

const PARTNERS = [
  { id: 1, label: "Partner institution A", image: "/a.png" },
  { id: 2, label: "Partner institution B", image: "/b.png" },
  { id: 3, label: "Partner institution C", image: "/c.png" },
];

export default function AffiliationsBanner() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.2 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="border-gold/10 border-y bg-[#521021] py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-6">
        <p className="text-[9px] font-bold tracking-[0.32em] text-white/35 uppercase">
          In affiliation with esteemed institutions &amp; partners in Islamic
          education
        </p>
        <div ref={ref} className="flex flex-wrap justify-center gap-12">
          {PARTNERS.map((partner, i) => (
            <div
              key={partner.id}
              aria-label={partner.label}
              className="transition-all duration-500 ease-out"
              style={{
                transitionDelay: `${i * 100}ms`,
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(16px)",
              }}
            >
              <img
                src={partner.image}
                alt={partner.label}
                className="ring-gold/25 hover:ring-gold/60 h-16 w-16 rounded-full opacity-70 ring-1 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
