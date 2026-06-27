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
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-black/20 backdrop-blur-md border-b border-white/10"
          : "bg-transparent",
      ].join(" ")}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/aqa-logo.png"
            alt="Al-Qur'an Academy"
            width={44}
            height={44}
            className="h-10 w-10 rounded-full object-cover shrink-0"
          />
          <div className="leading-none">
            <p className="text-white text-xs font-semibold tracking-wide">AL-QUR&apos;AN ACADEMY</p>
            <p className="text-white/50 text-[10px] tracking-widest mt-0.5">INTERNATIONAL</p>
          </div>
        </Link>

        {/* Login CTA */}
        <Link
          href="/login"
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        >
          <UserCircle2 className="w-4 h-4" />
          <span className="hidden sm:inline">Login</span>
        </Link>
      </div>
    </header>
  );
}
