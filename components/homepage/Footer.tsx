import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-gold/12 border-t bg-[#3d0b17] py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-6 text-center">
        <div className="flex items-center gap-3">
          <span className="relative flex h-9 w-9 items-center justify-center">
            <span className="border-gold/40 absolute inset-0 rotate-45 border" />
            <Image
              src="/aqa-logo.png"
              alt="Al-Qur'an Academy"
              width={36}
              height={36}
              className="h-7 w-7 rounded-full object-cover"
            />
          </span>
          <div className="text-left leading-none">
            <p className="text-xs font-semibold tracking-wide text-white">
              AL-QUR&apos;AN ACADEMY
            </p>
            <p className="text-gold/80 mt-1 text-[10px] tracking-[0.35em]">
              INTERNATIONAL
            </p>
          </div>
        </div>
        <span className="bg-gold/20 h-px w-24" />
        <p className="text-[11px] tracking-wide text-white/40">
          &copy; {new Date().getFullYear()} Al-Qur&apos;an Academy
          International. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
