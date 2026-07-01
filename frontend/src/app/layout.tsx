import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: "Fikra Academy — Persiapan SNBT & UTBK",
  description:
    "Platform persiapan SNBT/UTBK dengan tryout berstandar, analisis performa, dan Kak Fikra, tutor AI yang siap bantu kamu lolos PTN impian.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jakarta.variable} ${fraunces.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
