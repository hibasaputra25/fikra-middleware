"use client";

import { useState } from "react";
import Link from "next/link";
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

  const accentColors = {
    primary: "border-primary",
    secondary: "border-secondary",
    admin: "border-admin-accent",
  };

  const activeTextColors = {
    primary: "text-primary",
    secondary: "text-secondary",
    admin: "text-admin-accent",
  };

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-50 bg-bg-card border-b border-border">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">FA</span>
            </div>
            <span className="text-base font-semibold text-text-primary hidden sm:block">
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
                    "px-3 py-2 text-sm rounded-md transition-colors",
                    isActive
                      ? cn("font-medium", activeTextColors[accent])
                      : "text-text-secondary hover:text-text-primary hover:bg-gray-50"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-text-secondary" />
                </div>
                <span className="text-sm text-text-secondary">{user.nama}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 text-text-muted hover:text-text-primary rounded-md hover:bg-gray-50 transition-colors"
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
                    "block px-3 py-2.5 text-sm rounded-md transition-colors",
                    isActive
                      ? cn("font-medium", activeTextColors[accent])
                      : "text-text-secondary hover:text-text-primary hover:bg-gray-50"
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