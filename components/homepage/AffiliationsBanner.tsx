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
    <section className="bg-primary py-10">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <p className="text-primary-foreground/90 text-sm italic mb-8">
          In affiliation with esteemed institution and partners in Islamic
          education
        </p>
        <div ref={ref} className="flex justify-center gap-8 flex-wrap">
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
              <div className="flex items-center justify-center">
                <img
                  src={partner.image}
                  alt={partner.label}
                  className="w-20 h-20 rounded-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
