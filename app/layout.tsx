import type { Metadata } from "next";
import { Bowlby_One, Cal_Sans, Geist, Geist_Mono, Poppins } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
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
        calSans.variable,
        bowlbyOne.variable,
        gveretLevin.variable,
      )}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
