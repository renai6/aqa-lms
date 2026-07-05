"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { UserCircle2 } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "fixed top-0 right-0 left-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-primary/95 border-gold/15 border-b backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center">
            <span className="border-gold/40 absolute inset-0 rotate-45 border transition-transform duration-500 group-hover:rotate-[135deg]" />
            <Image
              src="/aqa-logo.png"
              alt="Al-Qur'an Academy"
              width={44}
              height={44}
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          </span>
          <div className="leading-none">
            <p className="text-xs font-semibold tracking-wide text-white">
              AL-QUR&apos;AN ACADEMY
            </p>
            <p className="text-gold/80 mt-1 text-[10px] tracking-[0.35em]">
              INTERNATIONAL
            </p>
          </div>
        </Link>

        {/* Login CTA */}
        <Link
          href="/login"
          className="bg-gold text-primary hover:bg-gold-soft flex items-center gap-2 px-5 py-2 text-[11px] font-bold tracking-[0.15em] uppercase transition-colors"
        >
          <UserCircle2 className="h-4 w-4" />
          <span className="hidden sm:inline">Login</span>
        </Link>
      </div>
    </header>
  );
}
