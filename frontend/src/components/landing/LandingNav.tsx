"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { label: "Tryout", href: "#tryout" },
  { label: "Cara Kerja", href: "#cara-kerja" },
  { label: "Kak Fikra", href: "#kak-fikra" },
  { label: "Testimoni", href: "#testimoni" },
];

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-bg-page/85 backdrop-blur-md border-b border-border"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="max-w-[1200px] mx-auto px-5 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/FA.png"
              alt="Fikra Academy"
              width={36}
              height={36}
              priority
              className="w-9 h-9 rounded-xl object-contain"
            />
            <span className="text-[17px] font-semibold tracking-tight text-text-primary">
              Fikra Academy
            </span>
          </Link>

          {/* Center links */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3.5 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-ink/[0.04]"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Right: auth */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-text-primary hover:text-primary transition-colors"
            >
              Masuk
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-full hover:bg-primary-hover transition-colors shadow-sm"
            >
              Daftar gratis
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 -mr-2 text-text-primary"
            aria-label={open ? "Tutup menu" : "Buka menu"}
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {open && (
        <div className="md:hidden bg-bg-page border-t border-border">
          <div className="px-5 py-4 space-y-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-ink/[0.04]"
              >
                {l.label}
              </a>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full text-center px-4 py-2.5 text-sm font-semibold text-text-primary border border-border rounded-full"
              >
                Masuk
              </Link>
              <Link
                href="/login"
                className="w-full text-center px-4 py-2.5 text-sm font-semibold text-white bg-primary rounded-full"
              >
                Daftar gratis
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
