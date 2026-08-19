import Image from "next/image";
import Link from "next/link";

const LINKS = [
  { label: "Programs", href: "#programs" },
  { label: "Faculty", href: "#core" },
  { label: "Curriculum", href: "#core" },
  { label: "Home", href: "/" },
];

/**
 * Marketing footer for the public homepage.
 *
 * Separate from the shared `Footer` used by the (public) course pages, which
 * keeps the original dark/gold treatment.
 */
export default function SiteFooter() {
  return (
    <footer className="bg-brand-maroon-deep py-14">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-5">
          <Image
            src="/aqa-logo.png"
            alt="Al-Qur'an Academy"
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
          />
          <p className="text-xs leading-relaxed text-white">
            Copyright &copy; {new Date().getFullYear()}{" "}
            Al-Qur&apos;an Academy International.
            <br />
            All rights reserved.
          </p>
        </div>

        <nav className="flex flex-wrap gap-6">
          {LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-xs text-white transition-opacity hover:opacity-70"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
