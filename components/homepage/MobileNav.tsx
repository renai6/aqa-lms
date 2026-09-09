"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

type NavItem = { label: string; href: string };

/**
 * Below `sm` the header bar has no room for the inline links, so they move
 * into a panel behind a menu button.
 *
 * `SiteHeader` owns the link list and passes it in, so the two renderings
 * cannot drift apart. The panel is positioned against the fixed header, which
 * is its containing block, so it tracks the bar's height on its own.
 */
export default function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // The panel covers the page, so what is behind it must not scroll.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="site-mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        className="-ml-2 rounded-full p-2 text-white transition-colors hover:bg-white/10"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <>
          {/* Both sit below the bar, so the logo and the button stay visible
              and the button keeps working as the close control. */}
          <div
            onClick={() => setOpen(false)}
            aria-hidden
            className="absolute top-full right-0 left-0 h-screen bg-black/40"
          />
          <nav
            id="site-mobile-nav"
            className="bg-brand-maroon animate-in fade-in slide-in-from-top-2 absolute top-full right-0 left-0 flex flex-col border-t border-white/10 px-6 duration-200"
          >
            {items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-white/10 py-4 text-[15px] font-medium text-white/90 transition-colors last:border-b-0 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
