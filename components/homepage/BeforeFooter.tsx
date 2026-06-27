"use client";

import { useEffect, useRef, useState } from "react";

export default function BeforeFooter() {
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
        <p className="text-primary-foreground/90 text-sm mb-8 quote-italic">
          "If Muslims really desire to make a difference, then{" "}
          <span className="font-bold text-orange-300">
            {" "}
            strive to attain both academic and Islamic knowledge"
          </span>
        </p>
        <p className="text-primary-foreground/90 text-sm mb-8 text-italic">
          - Sheikh Vladimir Sahiron, AQA President
        </p>
      </div>
    </section>
  );
}
