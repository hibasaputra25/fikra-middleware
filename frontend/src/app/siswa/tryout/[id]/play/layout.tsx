"use client";

import AuthGuard from "@/components/layout/AuthGuard";
import Image from "next/image";
import { useAuthStore } from "@/stores/authStore";
import { LogOut, User, AlertTriangle, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

export default function QuizPlayerLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isQuizActive, setIsQuizActive] = useState(false);

  // Listen untuk event dari page.tsx yang memberitahu apakah quiz sedang aktif
  useEffect(() => {
    const handleQuizActive = (e: CustomEvent) => {
      setIsQuizActive(e.detail.active);
    };
    window.addEventListener('quiz-active', handleQuizActive as EventListener);
    return () => window.removeEventListener('quiz-active', handleQuizActive as EventListener);
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    if (isQuizActive) {
      e.preventDefault();
      setShowExitConfirm(true);
    } else {
      router.push('/siswa/tryout');
    }
  };

  const handleExitConfirmed = () => {
    // Emit event ke page.tsx untuk simpan progress sebelum keluar
    window.dispatchEvent(new CustomEvent('quiz-save-and-exit'));
    setShowExitConfirm(false);
  };

  return (
    <AuthGuard allowedRoles={["siswa"]}>
      {/* Modal konfirmasi keluar via logo */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowExitConfirm(false)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <button
              onClick={() => setShowExitConfirm(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
            <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
            <h2 className="font-semibold text-text-primary mb-2">Keluar dari tryout?</h2>
            <p className="text-sm text-text-secondary mb-5">
              Progress kamu akan disimpan. Kamu bisa melanjutkan tryout ini nanti dari soal yang sama.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowExitConfirm(false)}
              >
                Lanjutkan
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleExitConfirmed}
              >
                Simpan & Keluar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Navbar minimal khusus quiz player */}
      <header className="sticky top-0 z-40 bg-bg-card/90 backdrop-blur-md border-b border-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo — intercept klik kalau quiz aktif */}
            <button
              onClick={handleLogoClick}
              className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity"
            >
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
            </button>

            {/* User info + logout */}
            <div className="flex items-center gap-2.5">
              {user && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {user.nama?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                  </div>
                  <span className="text-sm font-medium text-text-primary max-w-[140px] truncate hidden sm:block">
                    {user.nama}
                  </span>
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
            </div>
          </div>
        </div>
      </header>
      {children}
    </AuthGuard>
  );
}
