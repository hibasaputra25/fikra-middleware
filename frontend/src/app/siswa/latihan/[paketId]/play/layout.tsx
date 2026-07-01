"use client";

import AuthGuard from "@/components/layout/AuthGuard";
import Image from "next/image";
import { useAuthStore } from "@/stores/authStore";
import { LogOut, User, AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Button from "@/components/ui/Button";

export default function LatihanPlayerLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"logo" | "logout">("logo");

  // Quiz aktif jika path mengandung attemptId (ada angka setelah /play/)
  const isQuizActive = /\/play\/\d+/.test(pathname ?? "");

  const handleLogoClick = () => {
    if (isQuizActive) {
      setModalType("logo");
      setShowModal(true);
    } else {
      router.push('/siswa/latihan');
    }
  };

  const handleLogoutClick = () => {
    setModalType("logout");
    setShowModal(true);
  };

  const handleConfirm = () => {
    setShowModal(false);
    if (modalType === "logout") {
      logout();
      window.location.href = "/login";
    } else {
      router.push('/siswa/latihan');
    }
  };

  return (
    <AuthGuard allowedRoles={["siswa"]}>
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
            <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
            <h2 className="font-semibold text-text-primary mb-2">
              {modalType === "logout" ? "Keluar dari akun?" : "Keluar dari latihan?"}
            </h2>
            <p className="text-sm text-text-secondary mb-5">
              Progress kamu akan disimpan. Kamu bisa melanjutkan latihan ini nanti dari soal yang sama.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                Lanjutkan
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleConfirm}>
                {isQuizActive ? "Simpan & Keluar" : "Ya, Keluar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-bg-card/90 backdrop-blur-md border-b border-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <button onClick={handleLogoClick} className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity">
              <Image src="/FA.png" alt="Fikra Academy" width={32} height={32} priority className="w-8 h-8 rounded-lg object-contain" />
              <span className="text-base font-semibold tracking-tight text-text-primary hidden sm:block">Fikra Academy</span>
            </button>
            <div className="flex items-center gap-2.5">
              {user && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {user.nama?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                  </div>
                  <span className="text-sm font-medium text-text-primary max-w-[140px] truncate hidden sm:block">{user.nama}</span>
                </div>
              )}
              <button onClick={handleLogoutClick} className="p-2 text-text-muted hover:text-danger rounded-full hover:bg-ink/[0.04] transition-colors" title="Keluar" aria-label="Keluar">
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
