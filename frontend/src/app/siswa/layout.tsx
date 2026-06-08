"use client";

import Navbar from "@/components/layout/Navbar";
import AuthGuard from "@/components/layout/AuthGuard";

const navItems = [
  { label: "Dashboard", href: "/siswa/dashboard" },
  { label: "Tryout", href: "/siswa/tryout" },
  { label: "Riwayat", href: "/siswa/riwayat" },
  { label: "Chat", href: "/siswa/chat" },
];

export default function SiswaLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["siswa"]}>
      <Navbar items={navItems} accent="primary" />
      {children}
    </AuthGuard>
  );
}