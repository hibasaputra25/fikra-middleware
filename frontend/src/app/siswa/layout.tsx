"use client";

import Navbar from "@/components/layout/Navbar";
import AuthGuard from "@/components/layout/AuthGuard";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/siswa/dashboard" },
  { label: "Tryout", href: "/siswa/tryout" },
  { label: "Latihan", href: "/siswa/latihan" },
  { label: "Riwayat", href: "/siswa/riwayat" },
  { label: "Chat", href: "/siswa/chat" },
];

export default function SiswaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isQuizPlayer = pathname?.includes("/play");

  return (
    <AuthGuard allowedRoles={["siswa"]}>
      {!isQuizPlayer && <Navbar items={navItems} accent="primary" />}
      {children}
    </AuthGuard>
  );
}