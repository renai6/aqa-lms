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
    <section className="bg-white py-16">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-6">
        <p className="text-center text-base text-[#5c5c5c]">
          In affiliation with trusted partners for Islamic education
        </p>
        <div ref={ref} className="flex flex-wrap justify-center gap-10">
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
                className="h-20 w-20 rounded-full bg-white object-contain p-2 shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-transform duration-300 hover:-translate-y-1"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
