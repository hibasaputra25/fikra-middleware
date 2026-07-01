"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { Menu, X, LogOut, User, AlertTriangle, ChevronDown } from "lucide-react";
import NotificationBell from "./NotificationBell";

interface NavItem {
  label: string;
  href: string;
}

interface NavbarProps {
  items: NavItem[];
  accent?: "primary" | "secondary" | "admin";
  maxVisible?: number; // berapa item yang tampil langsung, sisanya masuk "Lainnya"
}

export default function Navbar({ items, accent = "primary", maxVisible = 6 }: NavbarProps) {
  const [mobileOpen,       setMobileOpen]       = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [moreOpen,         setMoreOpen]          = useState(false);
  const pathname   = usePathname();
  const { user, logout } = useAuthStore();
  const moreRef    = useRef<HTMLDivElement>(null);

  const visibleItems = items.slice(0, maxVisible);
  const moreItems    = items.slice(maxVisible);
  const hasMore      = moreItems.length > 0;
  const isMoreActive = moreItems.some(
    item => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  // Close dropdown saat klik di luar
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreOpen]);

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

  const handleLogoutConfirmed = () => {
    logout();
    window.location.href = "/login";
  };

  return (
    <>
      {/* Modal konfirmasi logout */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <button onClick={() => setShowLogoutConfirm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
            <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
            <h2 className="font-semibold text-text-primary mb-2">Keluar dari akun?</h2>
            <p className="text-sm text-text-secondary mb-5">
              Kamu akan keluar dari sesi ini. Sampai jumpa lagi!
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-xl hover:bg-gray-50 transition-colors"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Batal
              </button>
              <button
                className="flex-1 px-4 py-2 text-sm font-medium bg-danger text-white rounded-xl hover:bg-danger/90 transition-colors"
                onClick={handleLogoutConfirmed}
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/FA.png" alt="Fikra Academy" width={28} height={28}
              className="w-7 h-7 rounded-lg object-contain" priority />
            <span className="text-[15px] font-semibold tracking-tight text-text-primary hidden sm:block">
              Fikra Academy
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {visibleItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3.5 py-2 text-sm rounded-full transition-colors whitespace-nowrap",
                    isActive
                      ? cn("font-semibold", activeTextColors[accent], activeBgColors[accent])
                      : "text-text-secondary hover:text-text-primary hover:bg-ink/[0.04]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            {/* Dropdown "Lainnya" untuk item overflow */}
            {hasMore && (
              <div className="relative" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen(o => !o)}
                  className={cn(
                    "flex items-center gap-1 px-3.5 py-2 text-sm rounded-full transition-colors whitespace-nowrap",
                    isMoreActive
                      ? cn("font-semibold", activeTextColors[accent], activeBgColors[accent])
                      : "text-text-secondary hover:text-text-primary hover:bg-ink/[0.04]"
                  )}
                >
                  Lainnya
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", moreOpen && "rotate-180")} />
                </button>

                {moreOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                    {moreItems.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            "flex items-center px-3.5 py-2.5 text-sm transition-colors",
                            isActive
                              ? cn("font-semibold", activeTextColors[accent], activeBgColors[accent])
                              : "text-text-secondary hover:text-text-primary hover:bg-gray-50"
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            {/* Bell notifikasi — hanya untuk siswa & guru */}
            {user && user.role !== 'admin' && (
              <NotificationBell />
            )}
            {user && (
              <div className="hidden sm:flex items-center gap-2.5 pl-1">
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColors[accent])}>
                  {user.nama?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                </div>
                <span className="text-sm font-medium text-text-primary max-w-[120px] truncate">{user.nama}</span>
              </div>
            )}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="hidden sm:flex p-2 rounded-lg hover:bg-ink/[0.06] text-text-muted hover:text-danger transition-colors"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-ink/[0.06] transition-colors"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-border-light bg-white px-4 py-3">
            <div className="flex flex-col gap-0.5">
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
              <button
                onClick={() => { setMobileOpen(false); setShowLogoutConfirm(true); }}
                className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm text-danger rounded-lg hover:bg-red-50 transition-colors mt-1"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </button>
            </div>
          </nav>
        )}
      </header>
    </>
  );
}