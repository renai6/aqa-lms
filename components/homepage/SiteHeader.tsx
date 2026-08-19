import Link from "next/link";
import Image from "next/image";

const NAV = [
  { label: "Programs", href: "#programs" },
  { label: "Faculty", href: "#core" },
];

const NAV_RIGHT = [{ label: "Curriculum", href: "#core" }];

/**
 * Marketing header for the public homepage: nav links either side of a
 * centred mark, with the sign-in pill on the right.
 *
 * Separate from the shared `Navbar` used by the (public) course pages, which
 * keeps the original dark/gold treatment.
 */
export default function SiteHeader() {
  return (
    <header className="bg-brand-maroon fixed top-0 right-0 left-0 z-50">
      <div className="mx-auto flex h-[60px] max-w-5xl items-center justify-center gap-6 px-6 sm:gap-10">
        <nav className="hidden items-center gap-8 sm:flex sm:gap-12">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-[13px] font-medium text-white/80 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link href="/" className="shrink-0" aria-label="Al-Qur'an Academy">
          <Image
            src="/aqa-logo.png"
            alt="Al-Qur'an Academy"
            width={48}
            height={48}
            className="h-10 w-10 rounded-full bg-white object-cover"
          />
        </Link>

        <nav className="hidden items-center gap-8 sm:flex sm:gap-12">
          {NAV_RIGHT.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-[13px] font-medium text-white/80 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/login"
          className="text-brand-maroon-dark hover:bg-brand-cream rounded-full bg-white px-5 py-2 text-sm font-medium transition-colors"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}
