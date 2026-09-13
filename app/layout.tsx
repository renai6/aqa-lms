import type { Metadata } from "next";
import { Bowlby_One, Cal_Sans, Geist, Geist_Mono, Poppins } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

/* Poppins carries no Arabic glyphs, so Arabic content - lesson and subject
   titles - fell back to whatever face the browser happened to ship. Naskh
   covers it, and --font-sans lists it ahead of Poppins so no component has to
   know which script it is rendering.

   Self-hosted rather than pulled from next/font/google because the ordering
   only works with an explicit unicode-range, and next/font has no way to set
   one. Listing it first is what beats the metric-adjusted local("Arial") face
   next/font appends after Poppins - Arial ships Arabic glyphs on macOS and
   Windows, so left in front it would swallow the whole script. The range also
   means the file is only fetched on pages that actually contain Arabic.

   The woff2 is the "arabic" subset of Noto Naskh Arabic v44, variable across
   400-700; the range below is that subset's own, copied from Google's CSS.
   size-adjust is there because Naskh draws small for its em - at 100% the
   Arabic reads a size below the Latin sitting next to it in the same row. */
const notoNaskhArabic = localFont({
  src: "./fonts/NotoNaskhArabic-Arabic.woff2",
  weight: "400 700",
  style: "normal",
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-arabic",
  declarations: [
    { prop: "size-adjust", value: "118%" },
    {
      prop: "unicode-range",
      value:
        "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC",
    },
  ],
});

/* Display face for the public homepage headings. */
const calSans = Cal_Sans({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-cal-sans",
});

/* Chunky face for the "KIDS" lettering on the program cards. */
const bowlbyOne = Bowlby_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bowlby",
});

/* Script face for the president's quote. Self-hosted because Gveret Levin
   is not in next/font/google's manifest. */
const gveretLevin = localFont({
  src: "./fonts/GveretLevin-Regular.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-gveret",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Al-Qur'an Academy",
  description: "A modern learning management system for Al-Qur'an Academy.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        poppins.variable,
        notoNaskhArabic.variable,
        calSans.variable,
        bowlbyOne.variable,
        gveretLevin.variable,
      )}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
