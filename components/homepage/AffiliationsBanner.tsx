"use client";

import { useEffect, useRef, useState } from "react";
import { Building2 } from "lucide-react";

const PARTNERS = [
  { id: 1, label: "Partner institution 1" },
  { id: 2, label: "Partner institution 2" },
  { id: 3, label: "Partner institution 3" },
];

export default function AffiliationsBanner() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="bg-primary py-10">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <p className="text-primary-foreground/90 text-sm italic mb-8">
          In affiliation with esteemed institution and partners in Islamic education
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
              <div className="w-20 h-20 rounded-full bg-white border-2 border-white/80 shadow-inner flex items-center justify-center">
                <Building2 className="w-8 h-8 text-zinc-400" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
