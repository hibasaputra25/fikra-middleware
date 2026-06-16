"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { Menu, X, LogOut, User } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
}

interface NavbarProps {
  items: NavItem[];
  accent?: "primary" | "secondary" | "admin";
}

export default function Navbar({ items, accent = "primary" }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const activeTextColors = {
    primary: "text-primary",
    secondary: "text-secondary",
    admin: "text-text-primary",
  };

  const activeBgColors = {
    primary: "bg-primary-light",
    secondary: "bg-secondary-light",
    admin: "bg-ink/[0.06]",
  };

  const avatarColors = {
    primary: "bg-primary",
    secondary: "bg-secondary",
    admin: "bg-ink",
  };

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-50 bg-bg-card/85 backdrop-blur-md border-b border-border">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/FA.png"
              alt="Fikra Academy"
              width={32}
              height={32}
              priority
              className="w-8 h-8 rounded-lg object-contain"
            />
            <span className="text-base font-semibold tracking-tight text-text-primary hidden sm:block">
              Fikra Academy
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3.5 py-2 text-sm rounded-full transition-colors",
                    isActive
                      ? cn("font-semibold", activeTextColors[accent], activeBgColors[accent])
                      : "text-text-secondary hover:text-text-primary hover:bg-ink/[0.04]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden sm:flex items-center gap-2.5 pl-1">
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColors[accent])}>
                  {user.nama?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                </div>
                <span className="text-sm font-medium text-text-primary max-w-[140px] truncate">{user.nama}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 text-text-muted hover:text-danger rounded-full hover:bg-ink/[0.04] transition-colors"
              title="Keluar"
              aria-label="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-text-secondary hover:text-text-primary rounded-md"
              aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-border bg-bg-card">
          <div className="max-w-[1200px] mx-auto px-4 py-2">
            {items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "block px-3 py-2.5 text-sm rounded-lg transition-colors",
                    isActive
                      ? cn("font-semibold", activeTextColors[accent], activeBgColors[accent])
                      : "text-text-secondary hover:text-text-primary hover:bg-ink/[0.04]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}