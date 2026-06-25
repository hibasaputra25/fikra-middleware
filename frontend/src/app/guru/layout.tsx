"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import AuthGuard from "@/components/layout/AuthGuard";
import { useAuthStore } from "@/stores/authStore";
import { quizAPI } from "@/lib/api";

export default function GuruLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const [newResultsCount, setNewResultsCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    // Cek berapa siswa yang baru submit (in_progress attempts dari tryout guru)
    // Simplified: cek total in_progress dari semua tryout
    quizAPI.adminGetAll()
      .then(res => {
        const tryouts = res.data.data || [];
        // Count tryouts yang punya in_progress attempts
        let count = 0;
        Promise.all(tryouts.map(t =>
          quizAPI.adminGetAttempts(t.id)
            .then(ar => { count += ar.data.in_progress || 0; })
            .catch(() => {})
        )).then(() => setNewResultsCount(count));
      })
      .catch(() => {});
  }, [user?.id]);

  const navItems = [
    { label: "Dashboard", href: "/guru/dashboard" },
    { label: "Siswa", href: "/guru/siswa" },
    { label: "Undangan", href: "/guru/siswa/invite" },
    { label: `Tryout${newResultsCount > 0 ? ` (${newResultsCount})` : ""}`, href: "/guru/tryout" },
    { label: "Bank Soal", href: "/guru/soal" },
    { label: "Sesi Kelas", href: "/guru/sesi" },
  ];

  return (
    <AuthGuard allowedRoles={["guru"]}>
      <Navbar items={navItems} accent="secondary" />
      {children}
    </AuthGuard>
  );
}